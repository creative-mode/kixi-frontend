import * as friends from '../friends';
import { institutionsCounted as countInstitutions, rankGlobal } from '../global-ranking';
import { VISIBILITY_SCOPES, fromWireVisibility, toWireVisibility, type RankingVisibilityScope } from '../../ranking-rules';

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

    // Visibilidade por âmbito (#611): quem escolheu `hidden` sai da tabela dos
    // colegas mas continua a ver a sua posição; `anonymous` mantém a posição e
    // perde o nome. As posições dos restantes não são renumeradas.
    const visibilityOf = (id: number) => db.rankingVisibility[`${id}:${scope}`] ?? 'visible';
    const rankable = averages.filter((row) => visibilityOf(row.accountId) !== 'hidden');
    const totalStudents = scope === 'global' ? averages.length : members.length;
    const rankedStudents = rankable.length;
    const smallGroup = scope !== 'friends' && Math.min(totalStudents, rankedStudents) < 10;
    const myIndex = averages.findIndex((r) => r.accountId === account.id);
    const myRow = myIndex >= 0 ? averages[myIndex] : null;

    // Pódio (top 5, só em grupos grandes) + 2 vizinhos de cada lado da própria
    // posição - nunca a tabela toda, e os últimos lugares de um grupo pequeno não
    // entram mesmo que caiam na janela de vizinhos. O pódio sai das linhas que
    // continuam no ranking: um aluno escondido não vira «1.º» por cima.
    const NEIGHBOURS = 2;
    const PODIUM = 5;
    const visible = new Set<number>();
    if (!smallGroup) {
      for (const row of rankable.slice(0, PODIUM)) {
        const index = averages.indexOf(row);
        if (index >= 0) visible.add(index);
      }
    }
    if (myIndex >= 0) {
      for (let i = Math.max(0, myIndex - NEIGHBOURS); i <= Math.min(averages.length - 1, myIndex + NEIGHBOURS); i++) {
        // Em grupo pequeno, os últimos lugares não entram só por caírem na janela
        // de vizinhos - a não ser que seja a própria posição do aluno. O piso é o
        // mesmo do backend (#621): posição acima de `rankable - NEIGHBOURS`.
        const tail = smallGroup && averages[i].position > rankable.length - NEIGHBOURS;
        if (tail && i !== myIndex) continue;
        visible.add(i);
      }
    }

    const entries = [...visible]
      .sort((a, b) => a - b)
      .filter((i) => averages[i].accountId === account.id || visibilityOf(averages[i].accountId) !== 'hidden')
      .map((i) => {
        const row = averages[i];
        const preference = visibilityOf(row.accountId);
        const displayName = row.accountId === account.id
          ? maskedName(db, row.accountId) ?? 'Aluno'
          : scope === 'global'
            ? 'Aluno de outra escola'
            : preference === 'anonymous'
              ? 'Um colega'
              : maskedName(db, row.accountId) ?? 'Aluno';
        return {
          position: row.position,
          accountId: row.accountId === account.id ? account.id : null,
          displayName,
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

  // ── preferências de visibilidade (#611, contrato do kixi#619) ─────────────
  // Uma leitura devolve os três âmbitos; o PUT escreve um e devolve o estado
  // completo, como o LeaderboardController. A conta vem sempre da sessão.
  // `out` guarda-se como `hidden`, o nome que a janela usa ao filtrar linhas.
  const visibilityResponse = () => json({
    preferences: VISIBILITY_SCOPES.map((scope) => ({
      scope,
      rankingVisibility: toWireVisibility(fromWireVisibility(
        db.rankingVisibility[`${account.id}:${scope}`] ?? 'visible',
      )),
    })),
  });

  if (pathname === '/leaderboard/preferences' && method === 'GET') {
    return visibilityResponse();
  }

  if (pathname.startsWith('/leaderboard/preferences/') && method === 'PUT') {
    const scope = pathname.slice('/leaderboard/preferences/'.length);
    const rankingVisibility = text('rankingVisibility');
    if (!VISIBILITY_SCOPES.includes(scope as RankingVisibilityScope)) {
      return problem(400, 'scope must be class, school or friends');
    }
    if (!['visible', 'anonymous', 'out'].includes(rankingVisibility)) {
      return problem(400, 'rankingVisibility must be visible, anonymous or out');
    }
    db.rankingVisibility[`${account.id}:${scope}`] = fromWireVisibility(rankingVisibility);
    return visibilityResponse();
  }

  if (pathname === '/leaderboard/consent' && method === 'PUT') {
    if (typeof body.crossInstitution !== 'boolean') return problem(400, 'crossInstitution is required: true to be ranked across institutions');
    db.crossConsent = db.crossConsent.filter((id) => id !== account.id);
    if (body.crossInstitution) db.crossConsent.push(account.id);
    return json({ crossInstitution: body.crossInstitution });
  }

  return undefined;
}
