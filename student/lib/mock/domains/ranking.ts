import * as friends from '../friends';
import { institutionsCounted as countInstitutions, rankGlobal } from '../global-ranking';

import { json, maskedName, problem } from '../store';
import type { MockCtx } from '../store';

/** Rotas do domínio «ranking» do mock; devolve `undefined` quando o pedido não é deste domínio. */
export async function rankingRoutes({ method, pathname, search, filter, body, text, accountId, account, staff, db }: MockCtx): Promise<Response | undefined> {
  void [method, pathname, search, filter, body, text, accountId, account, staff, db];
  // ── ranking (#117/#31) ──────────────────────────────────────────────────────
  // Espelha o LeaderboardController real: o grupo nunca vem de um parâmetro do
  // pedido, só da própria matrícula do chamador - não há combinação de query
  // que alcance o grupo de outra conta. "friends" chega com o kixi#121 (PR #204,
  // ainda em revisão); até lá o próprio backend real responde 404 a esse scope.
  if (pathname === '/leaderboard' && method === 'GET') {
    const scope = search.get('scope') ?? 'class';
    const period = search.get('period') ?? 'all';
    const statementId = filter('statementId');
    const metric = search.get('metric') ?? 'average';
    if (!['class', 'school', 'friends', 'global'].includes(scope)) {
      return problem(400, 'scope must be class, school, friends or global');
    }
    if (!['average', 'xp'].includes(metric)) return problem(400, 'metric must be average or xp');
    if (scope === 'global' && !db.crossConsent.includes(account.id)) {
      return problem(403, 'Consent is required to be ranked across institutions');
    }
    if (statementId !== undefined && !db.statements.some((s) => s.id === statementId)) {
      return problem(404, 'Statement not found');
    }

    const mine = db.enrollments.find((e) => e.accountId === account.id && e.status === 'ACTIVE');
    const empty = { scope, groupId: null, statementId: statementId ?? null, period, metric, institutionsCounted: 0, totalStudents: 0, rankedStudents: 0, smallGroup: true, myPosition: null, myAverage: null, entries: [] };
    if (!mine) return json(empty);
    const klass = db.classes.find((c) => c.id === mine.classId);
    if (!klass) return json(empty);
    const groupId = scope === 'friends' || scope === 'global' ? null : scope === 'class' ? mine.classId : klass.institutionId;
    // Amigos: o aluno e quem aceitou, esteja em que turma estiver (da mesma escola, como o backend).
    const circle = new Set([account.id, ...friends.friendIds(db.friendships, account.id)]);

    const members = db.enrollments.filter((e) => {
      if (e.status !== 'ACTIVE' || e.schoolYearId !== mine.schoolYearId) return false;
      if (scope === 'friends') return circle.has(e.accountId);
      if (scope === 'global') return db.crossConsent.includes(e.accountId);
      if (scope === 'class') return e.classId === groupId;
      return db.classes.find((c) => c.id === e.classId)?.institutionId === groupId;
    });

    const since = period === 'month' ? Date.now() - 30 * 24 * 3600 * 1000 : null;
    const base = members
      .map((e) => {
        const sims = db.simulations.filter(
          (s) =>
            s.accountId === e.accountId &&
            s.status === 'FINISHED' &&
            s.finalScore != null &&
            (statementId === undefined || s.statementId === statementId) &&
            (since === null || (s.finishedAt != null && new Date(s.finishedAt).getTime() >= since)),
        );
        if (sims.length === 0) return null;
        const average = sims.reduce((sum, s) => sum + (s.finalScore ?? 0), 0) / sims.length;
        return { accountId: e.accountId, average };
      })
      .filter((row): row is { accountId: number; average: number } => row !== null)
      .sort((a, b) => b.average - a.average)
      .map((row, i) => ({ ...row, position: i + 1 }));

    // Global: percentil dentro da própria escola, só com escolas acima do mínimo (ADR-0013).
    // XP: ordena pelo XP acumulado, como `metric=xp` no backend.
    type Row = { accountId: number; average: number; position: number; percentile?: number; xp?: number };
    const institutionOf = (id: number) => {
      const seat = db.enrollments.find((e) => e.accountId === id && e.status === 'ACTIVE');
      return db.classes.find((c) => c.id === seat?.classId)?.institutionId ?? 0;
    };
    const scored = base.map((r) => ({ accountId: r.accountId, institutionId: institutionOf(r.accountId), average: r.average }));
    let averages: Row[] = scope === 'global' ? rankGlobal(scored) : base;
    const institutionsCounted = scope === 'global' ? countInstitutions(scored) : 0;
    if (metric === 'xp') {
      const xpOf = (id: number) => db.userStats[id]?.xp ?? null;
      averages = averages
        .map((r) => ({ ...r, xp: xpOf(r.accountId) ?? undefined }))
        .sort((a, b) => (b.xp ?? -Infinity) - (a.xp ?? -Infinity))
        .map((r, i, all) => ({ ...r, position: i > 0 && all[i - 1].xp === r.xp ? 0 : i + 1 }));
      let last = 1;
      averages = averages.map((r) => { last = r.position || last; return { ...r, position: last }; });
    }

    const totalStudents = scope === 'global' ? averages.length : members.length;
    const rankedStudents = averages.length;
    const smallGroup = Math.min(totalStudents, rankedStudents) < 10;
    const myRow = averages.find((r) => r.accountId === account.id) ?? null;

    // Pódio (top 5, só em grupos grandes) + 2 vizinhos de cada lado da própria
    // posição - nunca a tabela toda, e os últimos lugares de um grupo pequeno não
    // entram mesmo que caiam na janela de vizinhos.
    const NEIGHBOURS = 2;
    const PODIUM = 5;
    const visible = new Set<number>();
    if (!smallGroup) for (let i = 0; i < Math.min(PODIUM, averages.length); i++) visible.add(i);
    if (myRow) {
      const idx = myRow.position - 1;
      for (let i = Math.max(0, idx - NEIGHBOURS); i <= Math.min(averages.length - 1, idx + NEIGHBOURS); i++) {
        // Em grupo pequeno, os últimos lugares não entram só por caírem na janela
        // de vizinhos - a não ser que seja a própria posição do aluno.
        const tail = smallGroup && i >= averages.length - NEIGHBOURS;
        if (tail && i !== idx) continue;
        visible.add(i);
      }
    }

    const entries = [...visible].sort((a, b) => a - b).map((i) => {
      const row = averages[i];
      return {
        position: row.position,
        accountId: row.accountId === account.id ? account.id : null,
        // No global o nome sai por inteiro: nem o nome abreviado, junto da escola, se esconde (ADR-0013).
        displayName: scope === 'global' && row.accountId !== account.id ? 'Aluno de outra escola' : (maskedName(db, row.accountId) ?? 'Aluno'),
        average: row.average,
        percentile: scope === 'global' ? (row.percentile ?? null) : null,
        xp: metric === 'xp' ? (row.xp ?? null) : null,
        me: row.accountId === account.id,
      };
    });

    return json({
      scope, groupId, statementId: statementId ?? null, period, metric, institutionsCounted, totalStudents, rankedStudents,
      smallGroup, myPosition: myRow?.position ?? null, myAverage: myRow?.average ?? null,
      myPercentile: scope === 'global' ? (myRow?.percentile ?? null) : null, entries,
    });
  }

  if (pathname === '/leaderboard/consent' && method === 'PUT') {
    if (typeof body.crossInstitution !== 'boolean') return problem(400, 'crossInstitution is required: true to be ranked across institutions');
    db.crossConsent = db.crossConsent.filter((id) => id !== account.id);
    if (body.crossInstitution) db.crossConsent.push(account.id);
    return json({ crossInstitution: body.crossInstitution });
  }

  return undefined;
}
