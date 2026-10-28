import { catalogPage } from '../catalog-page';
import { findVisible, summaryOf } from '../statement-detail';
import { isRestricted, isVisibility, matchesSearch, personAttributes, type Visibility } from '../profiles';
import { validateReport, blockPair, bloqueadoEntre, deveDesaparecer, desaparecePara, visibilidadePara } from '@/lib/moderation';
import { toLocalDateTime } from '../simulation';

import type { Institution } from '@/lib/types';
import { json, problem } from '../store';
import type { MockCtx } from '../store';

/** Rotas do domínio «profiles» do mock; devolve `undefined` quando o pedido não é deste domínio. */
export async function profilesRoutes({ method, pathname, search, filter, body, text, accountId, account, staff, db }: MockCtx): Promise<Response | undefined> {
  void [method, pathname, search, filter, body, text, accountId, account, staff, db];
  // ── perfis (#331/#336/#338): escolas, pessoas, pesquisa ───────────────────────
  /* ── denúncia e bloqueio (#323) ────────────────────────────────────────────
   * O endpoint de denúncia de publicação existia e não guardava nada: respondia 201
   * e a denúncia desaparecia. Aqui passa a haver registo, para o Manager ter fila.
   */
  const personReport = pathname.match(/^\/profiles\/accounts\/(\d+)\/reports$/);
  if (personReport && method === 'POST') {
    const target = db.accounts.find((a) => a.id === Number(personReport[1]));
    if (!target) return problem(404, 'Profile not found');
    const parsed = validateReport({ target: 'ACCOUNT', reason: body?.reason, note: typeof body?.note === 'string' ? body.note : '', reporterId: accountId, targetId: target.id });
    if (!parsed.ok) return problem(400, parsed.error);
    // Uma pessoa nao se denuncia a si mesma: nao ha moderacao que resolva isto.
    if (target.id === accountId) return problem(400, 'Nao podes denunciar-te a ti.');
    const row = { id: db.nextReport++, target: 'ACCOUNT' as const, targetId: target.id, reporterAccountId: accountId!, reason: parsed.reason, note: parsed.note, createdAt: toLocalDateTime(new Date()) };
    db.reports.push(row);
    return json(row, 201);
  }

  const schoolReport = pathname.match(/^\/institutions\/(\d+)\/reports$/);
  if (schoolReport && method === 'POST') {
    const target = db.institutions.find((i) => i.id === Number(schoolReport[1]));
    if (!target) return problem(404, 'Institution not found');
    const parsed = validateReport({ target: 'INSTITUTION', reason: body?.reason, note: typeof body?.note === 'string' ? body.note : '', reporterId: accountId, targetId: target.id });
    if (!parsed.ok) return problem(400, parsed.error);
    const row = { id: db.nextReport++, target: 'INSTITUTION' as const, targetId: target.id, reporterAccountId: accountId!, reason: parsed.reason, note: parsed.note, createdAt: toLocalDateTime(new Date()) };
    db.reports.push(row);
    return json(row, 201);
  }

  /** PUT /profiles/accounts/{id}/block — alterna o bloqueio nos dois sentidos. */
  const block = pathname.match(/^\/profiles\/accounts\/(\d+)\/block$/);
  if (block && method === 'PUT') {
    if (accountId === null) return problem(401, 'Unauthorized');
    const target = db.accounts.find((a) => a.id === Number(block[1]));
    if (!target) return problem(404, 'Profile not found');
    const par = blockPair(accountId, target.id);
    if (!par) return problem(400, 'Alvo invalido');
    const i = db.blocks.findIndex((b) => b.accountId === par.accountId && b.blockedAccountId === par.blockedAccountId);
    if (i >= 0) {
      db.blocks.splice(i, 1);
      return json({ blocked: false });
    }
    db.blocks.push({ ...par, createdAt: toLocalDateTime(new Date()) });
    return json({ blocked: true });
  }

  if (pathname.startsWith('/profiles/') && method === 'GET' || pathname === '/profiles/me/visibility') {
    const card = (i: Institution) => ({
      id: i.id, code: i.code, name: i.name, shortName: i.short_name, logo: i.logo, verified: i.id === 1,
    });
    const school = pathname.match(/^\/profiles\/institutions\/(\d+)(\/teachers)?$/);
    if (school) {
      const inst = db.institutions.find((i) => i.id === Number(school[1]));
      if (!inst) return problem(404, 'Institution not found');
      const classIds = new Set(db.classes.filter((c) => c.institutionId === inst.id).map((c) => c.id));
      if (school[2]) {
        return json(
          inst.id === 1
            ? [{ id: 1, accountId: 2, displayName: 'Bruno Mendes', photo: null, specialty: 'Redes', verified: true }]
            : [],
        );
      }
      return json({
        ...card(inst),
        verifiedAt: inst.id === 1 ? '2026-01-15T10:00:00' : null,
        teacherCount: inst.id === 1 ? 1 : 0,
        studentCount: db.enrollments.filter((e) => classIds.has(e.classId)).length,
        statementCount: db.statements.filter((x) => x.institutionId === inst.id).length,
      });
    }
    if (pathname === '/profiles/search') {
      const q = search.get('q') ?? '';
      if (q.trim().length < 2) return problem(400, 'q must have at least 2 characters');
      return json(db.institutions.filter((i) => matchesSearch(q, i)).map(card));
    }
    if (pathname === '/profiles/me/visibility') {
      if (accountId === null) return problem(401, 'Unauthorized');
      return json({ visibility: db.visibility[accountId] ?? 'school' });
    }
  const person = pathname.match(/^\/profiles\/(?:accounts|users)\/(\d+)$/);
  if (person) {
    const target = db.accounts.find((a) => a.id === Number(person[1]));
    if (!target) return problem(404, 'Profile not found');
    // Oculto ou suspenso devolve 404 a terceiros — o critério da #323. A si próprio
    // o perfil continua visível: sem esta excepção, denunciar-se a si por engano
    // deixava o aluno a ver o próprio perfil em 404.
    // Oculto, suspenso **ou bloqueado**: os três dão 404 a terceiros. Um bloqueio que
    // devolvesse «só o nome e a foto» não deixava de ver nada de útil.
    if (desaparecePara({
      mine: target.id === accountId,
      bloqueado: bloqueadoEntre(db.blocks, target.id, accountId ?? -1),
      oculto: deveDesaparecer({ hidden: target.hidden, suspended: target.suspended }),
    })) {
      return problem(404, 'Profile not found');
    }
    const ownVisibility = (db.visibility[target.id] ?? 'school') as Visibility;
    const mine = target.id === accountId;
      // O bloqueio é invisibilidade mútua e nada mais: cada um deixa de ver o perfil
      // do outro. Não impede comentários nem mensagens — é o que a issue pede.
      const effective = visibilidadePara({
        targetOwnVisibility: ownVisibility,
        mine,
        bloqueado: bloqueadoEntre(db.blocks, target.id, accountId ?? -1),
        desaparece: deveDesaparecer({ hidden: target.hidden, suspended: target.suspended }),
      });
      const visibility = effective;
      const restricted = isRestricted(visibility, mine);
      const classIds = db.enrollments.filter((e) => e.accountId === target.id).map((e) => e.classId);
      const schoolIds = new Set(db.classes.filter((c) => classIds.includes(c.id)).map((c) => c.institutionId));
      const isTeacher = target.roles.includes('TEACHER');
      const attrs = personAttributes(isTeacher, { level: 3, xp: 240, badges: ['Primeira prova'] }, 'Redes');
      return json({
        userId: target.id,
        displayName: `${target.firstName} ${target.lastName}`,
        photo: target.photo,
        kind: attrs.kind,
        verified: isTeacher,
        restricted,
        visibility,
        blocked: mine ? false : bloqueadoEntre(db.blocks, target.id, accountId ?? -1),
        schools: restricted
          ? []
          : db.institutions.filter((i) => schoolIds.has(i.id) || (isTeacher && i.id === 1)).map(card),
        level: restricted ? null : attrs.level,
        xp: restricted ? null : attrs.xp,
        badges: restricted ? [] : attrs.badges,
        specialty: restricted ? null : attrs.specialty,
      });
    }
  }
  if (pathname === '/profiles/me/visibility' && method === 'PUT') {
    if (accountId === null) return problem(401, 'Unauthorized');
    const value = text('visibility');
    if (!isVisibility(value)) return problem(400, 'Visibility must be public, school or private');
    db.visibility[accountId] = value;
    return json({ visibility: value });
  }

  if (pathname === '/institutions' && method === 'GET') {
    // `?onlyWithClassesInYear=<id>`: só as escolas com pelo menos uma turma nesse ano letivo.
    const year = filter('onlyWithClassesInYear');
    if (year === undefined) return json(db.institutions);
    const open = new Set(db.classes.filter((c) => c.schoolYearId === year).map((c) => c.institutionId));
    return json(db.institutions.filter((i) => open.has(i.id)));
  }

  if (pathname === '/subjects' && method === 'GET') return json(db.subjects);

  // Catalog, the StatementCatalogController shape: flat rows, paged. Filters mirror
  // the backend's @RequestParam names, including the 0-based page. Paging itself
  // lives in ./catalog-page so node --test can cover it (this file imports
  // server-only and cannot run outside Next).
  if (pathname === '/statements/catalog' && method === 'GET') {
    const num = (key: string) => {
      const value = search.get(key);
      return value === null || value === '' ? undefined : Number(value);
    };
    // O catálogo só devolve o que está publicado, como o `StatementCatalogService`.
    // Só agora é que a linha é única e uma prova oculta vive na mesma tabela: antes
    // o catálogo nunca viu uma linha não publicada, e não precisava do filtro.
    return json(
      catalogPage(db.statements.filter((s) => s.visible), {
        q: search.get('q')?.trim() || undefined,
        subjectId: num('subjectId'),
        schoolYearId: num('schoolYearId'),
        institutionId: num('institutionId'),
        examType: search.get('examType')?.trim() || undefined,
        page: num('page'),
        size: num('size'),
      }),
    );
  }

  // GET /statements/{id} — a StatementSummary. `findByIdVisible` no backend só devolve
  // o que está publicado, e responde 404 ao resto, inclusive a algo que existe.
  const detail = pathname.match(/^\/statements\/(\d+)$/);
  if (detail && method === 'GET') {
    const row = findVisible(db.statements, Number(detail[1]));
    if (!row) return problem(404, 'Statement not found');
    return json(summaryOf(row));
  }

  return undefined;
}
