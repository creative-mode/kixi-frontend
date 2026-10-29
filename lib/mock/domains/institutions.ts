/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
 
import { OGI_EXTRACTION } from '../ogi-extraction';
import { add, db, donationStore, hash, json, missing, moderationStore, now, problem, roleId, verificationStore } from '../store';
import type { MockContext } from './auth';

/** Rotas do domínio «institutions» do mock; devolve `undefined` quando o pedido não é deste domínio. */
export async function institutionRoutes({ method, path, url, auth, isStaff, readBody, loginResponse, isAdmin, activeInst, writeWorld, denyWrite }: MockContext): Promise<Response | undefined> {
  let m: RegExpMatchArray | null = null;
  void [m, url, auth, isStaff, readBody, loginResponse, isAdmin, activeInst, writeWorld, denyWrite];
  // ── institutions: affiliations and teacher access ──
  if (path === '/api/v1/institutions/mine' && method === 'GET') {
    if (isAdmin) return json(200, db.institutions.filter((i) => !i.deletedAt));
    const t = db.teachers.find((x) => x.accountId === Number(auth.sub) && !x.deletedAt);
    const ids = new Set(db.institutionTeachers.filter((l) => l.teacherId === t?.id).map((l) => l.institutionId));
    return json(200, db.institutions.filter((i) => !i.deletedAt && ids.has(i.id)));
  }
  // Espelha `TeachingAssignmentService.findMineForAccount`: procura o registo
  // de professor pela conta autenticada. Um ADMIN não tem registo de
  // professor, por isso recebe `[]` — como recebe o backend, não a lista toda.
  if (/^\/api\/(v1\/)?teaching-assignments\/me$/.test(path) && method === 'GET') {
    const t = db.teachers.find((x) => x.accountId === Number(auth.sub) && !x.deletedAt);
    const mine = t ? db['teaching-assignments'].filter((a) => a.teacherId === t.id) : [];
    return json(200, mine.filter((a) => !a.deletedAt));
  }
  if ((m = path.match(/^\/api\/v1\/institutions\/(\d+)\/(subjects|teachers|students)(?:\/(\d+))?$/))) {
    const inst = activeInst(m[1]);
    if (!inst) return problem(404, 'Institution not found');
    const kind = m[2];
    const table = { subjects: 'institutionSubjects', teachers: 'institutionTeachers', students: 'institutionStudents' }[kind];
    const idKey = { subjects: 'subjectId', teachers: 'teacherId', students: 'userId' }[kind];
    const links = () => db[table].filter((l) => l.institutionId === inst.id);
    if (method === 'GET' && !m[3]) {
      if (kind === 'subjects') return json(200, links().map((l) => db.subjects.find((x) => x.id === l.subjectId)).filter((x) => x && !x.deletedAt).map((x) => ({ id: x.id, code: x.code, name: x.name, short_name: x.short_name })));
      if (kind === 'teachers') return json(200, links().map((l) => db.teachers.find((x) => x.id === l.teacherId)).filter((x) => x && !x.deletedAt).map((x) => ({ id: x.id, firstName: x.firstName, lastName: x.lastName, email: x.email, hasAccess: !!x.accountId })));
      return json(200, links().map((l) => db.users.find((x) => x.id === l.userId)).filter((x) => x && !x.deletedAt).map((x) => ({ userId: x.id, accountId: x.accountId, firstName: x.firstName, lastName: x.lastName })));
    }
    const target = Number(m[3]);
    const source = { subjects: 'subjects', teachers: 'teachers', students: 'users' }[kind];
    if (method === 'POST' && m[3]) {
      if (!db[source].find((x) => x.id === target && !x.deletedAt)) return problem(404, `${kind.slice(0, -1)} not found`);
      if (kind === 'students' && !db.accountRoles.some((r) => r.accountId === db.users.find((u) => u.id === target).accountId && r.roleId === roleId('STUDENT'))) return problem(422, 'User is not a student');
      if (!links().some((l) => l[idKey] === target)) db[table].push({ institutionId: inst.id, [idKey]: target });
      return json(204);
    }
    if (method === 'DELETE' && m[3]) {
      db[table] = db[table].filter((l) => !(l.institutionId === inst.id && l[idKey] === target));
      return json(204);
    }
  }
  if ((m = path.match(/^\/api\/v1\/teachers\/(\d+)\/account$/))) {
    const t = db.teachers.find((x) => x.id === Number(m[1]) && !x.deletedAt);
    if (!t) return problem(404, 'Teacher not found');
    if (method === 'POST') {
      if (t.accountId) return problem(409, 'Teacher already has access');
      const b = readBody();
      const miss = missing(b, ['username', 'email', 'password']);
      if (miss.length) return problem(400, `${miss.join(', ')} is required`);
      const username = String(b.username).trim();
      const email = String(b.email).trim().toLowerCase();
      if (db.accounts.some((a) => !a.deletedAt && (a.username === username || a.email === email))) return problem(409, 'Username or email already exists');
      const acc = add('accounts', { username, email, passwordHash: hash(b.password), emailVerified: false, active: true, lastLogin: null });
      db.accountRoles.push({ accountId: acc.id, roleId: roleId('TEACHER') });
      t.accountId = acc.id;
      return json(200, { ...t, hasAccess: true });
    }
    if (method === 'DELETE') {
      const acc = db.accounts.find((a) => a.id === t.accountId);
      if (acc) acc.deletedAt = now();
      t.accountId = null;
      return json(204);
    }
  }

  // ── doações de enunciados (só ADMIN; o `POST` público vive na landing, não aqui) ──
  if ((m = path.match(/^\/api\/v1\/donations(?:\/(\d+))?(?:\/(files\/(\d+)|review|extract|link-statement))?$/))) {
    const store = donationStore();
    const donation = m[1] ? store.find((d) => d.id === Number(m[1])) : null;
    const summary = (d) => ({ id: d.id, reference: d.reference, status: d.status, institutionName: d.institutionName, subjectName: d.subjectName, examType: d.examType, classGrade: d.classGrade, schoolYear: d.schoolYear, fileCount: d.files.length, createdAt: d.createdAt });
    const detail = (d) => ({ ...d, files: d.files.map(({ id, originalName, contentType, sizeBytes }) => ({ id, originalName, contentType, sizeBytes })) });
    if (!m[1] && method === 'GET') {
      const wanted = url.searchParams.get('status');
      if (wanted && !['pending', 'approved', 'rejected', 'converted'].includes(wanted)) return problem(400, `Unknown status: ${wanted}`);
      const page = Number(url.searchParams.get('page') ?? 1);
      const limit = Number(url.searchParams.get('limit') ?? 20);
      if (!(page >= 1) || !(limit >= 1 && limit <= 50)) return problem(400, 'page or limit out of range');
      const rows = store.filter((d) => !wanted || d.status === wanted).sort((a, b) => b.id - a.id);
      const counts = Object.fromEntries(['pending', 'approved', 'rejected', 'converted'].map((k) => [k, store.filter((d) => d.status === k).length]));
      return json(200, { items: rows.slice((page - 1) * limit, page * limit).map(summary), total: rows.length, page, limit, counts });
    }
    if (!donation) return problem(404, `Donation not found: ${m[1]}`);
    if (!m[2] && method === 'GET') return json(200, detail(donation));
    if (m[3] && method === 'GET') {
      const file = donation.files.find((x) => x.id === Number(m[3]));
      if (!file) return problem(404, 'Donation file not found');
      return new Response(Buffer.from(file.base64, 'base64'), { status: 200, headers: { 'Content-Type': file.contentType, 'Content-Disposition': `attachment; filename="${file.originalName}"`, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'private, no-store' } });
    }
    if (m[2] === 'review' && method === 'PATCH') {
      const b = readBody();
      const decision = String(b.status ?? '').toLowerCase();
      if (!['approved', 'rejected'].includes(decision)) return problem(400, 'status must be approved or rejected');
      if (donation.status === 'converted') return problem(409, 'A converted donation can no longer be reviewed');
      Object.assign(donation, { status: decision, reviewNote: b.note ?? null, reviewedAt: now() });
      return json(200, detail(donation));
    }
    if (m[2] === 'extract' && method === 'POST') {
      if (!donation.files.length) return problem(409, 'This donation has no files');
      return json(200, { ...OGI_EXTRACTION, request_id: `req-${Date.now()}`, processing_time_ms: 900 });
    }
    if (m[2] === 'link-statement' && method === 'POST') {
      const b = readBody();
      if (donation.status === 'rejected') return problem(409, 'A rejected donation cannot become a statement');
      if (donation.status === 'converted') return donation.statementId === b.statementId ? json(200, detail(donation)) : problem(409, 'This donation was already converted into another statement');
      if (!db.statements.find((x) => x.id === b.statementId && !x.deletedAt)) return problem(404, `Statement not found: ${b.statementId}`);
      Object.assign(donation, { status: 'converted', statementId: b.statementId, reviewedAt: donation.reviewedAt ?? now() });
      return json(200, detail(donation));
    }
  }

  // ── verificação de escolas (#332): só o ADMIN revê ──
  if ((m = path.match(/^\/api\/v1\/moderation\/(reports|audit)(?:\/(\d+)\/(ignore|hide|suspend))?$/))) {
    if (!isAdmin) return problem(403, 'Forbidden');
    const store = moderationStore();
    if (m[2]) {
      // Uma decisão por denúncia; o registo de auditoria é o critério de aceitação
      // da issue, por isso escreve-se sempre, mesmo a ignorar.
      const report = store.reports.find((r) => r.id === Number(m[2]));
      if (!report) return problem(404, 'Report not found');
      if (report.status !== 'OPEN') return problem(409, 'Esta denúncia já foi decidida.');
      const action = m[3]!.toUpperCase();
      const status = action === 'IGNORE' ? 'IGNORED' : action === 'HIDE' ? 'HIDDEN' : 'SUSPENDED';
      if (report.target === 'INSTITUTION' && status === 'SUSPENDED') {
        // Uma escola não tem sessão: suspender não tem sentido e o modelo recusa.
        return problem(400, 'Uma escola pode ser ocultada, não suspensa.');
      }
      const note = String(readBody()?.note ?? '').trim();
      // O token traz `sub` e `roles`, nao o email. A auditoria precisa de dizer QUEM
      // decidiu, e o id serve: e o que o servidor consegue saber sem outro pedido.
      // O nome nao esta em `accounts`, esta em `users`: `seedAccount` põe o primeiro e
      // o ultimo nome na tabela `users` e devolve a conta. Uma auditoria com o actor
      // a dizer "undefined undefined" e pior do que sem registo nenhum.
      const conta = db.accounts.find((a) => String(a.id) === String(auth?.sub));
      const pessoa = conta && db.users.find((u) => u.accountId === conta.id);
      const actor = pessoa ? `${pessoa.firstName} ${pessoa.lastName}` : `conta ${auth?.sub ?? '?'}`;
      if (report.target === 'INSTITUTION') {
        const inst = activeInst(String(report.targetId));
        if (!inst) return problem(404, 'Institution not found');
        if (status === 'HIDDEN') inst.hidden = true;
      } else {
        const acc = db.accounts.find((a) => a.id === report.targetId);
        if (!acc) return problem(404, 'Account not found');
        if (status === 'HIDDEN') acc.hidden = true;
        if (status === 'SUSPENDED') { acc.suspended = true; acc.active = false; }
      }
      report.status = status;
      report.decidedAt = '2026-10-17T12:00:00';
      report.decidedBy = actor;
      report.decisionNote = note;
      store.audit.push({
        id: store.audit.length + 1, at: report.decidedAt, actor, action: status,
        target: report.target, targetId: report.targetId, targetName: report.targetName,
        reportId: report.id, note,
      });
      return json(200, report);
    }
    if (m[1] === 'audit') return json(200, [...store.audit].sort((a, b) => b.id - a.id));
    const wanted = url.searchParams.get('status')?.toUpperCase();
    return json(200, store.reports.filter((r) => !wanted || r.status === wanted).sort((a, b) => b.id - a.id));
  }

  if ((m = path.match(/^\/api\/v1\/(verification-requests(?:\/(\d+)\/(approve|reject))?|institutions\/(\d+)\/verification\/revoke)$/))) {
    if (!isAdmin) return problem(403, 'Forbidden');
    const store = verificationStore();
    if (m[4]) {
      const inst = activeInst(m[4]);
      if (!inst) return problem(404, 'Institution not found');
      inst.verified = false;
      for (const r of store) if (r.institutionId === inst.id && r.status === 'APPROVED') r.status = 'REVOKED';
      return json(204);
    }
    if (!m[2] && method === 'GET') {
      const wanted = url.searchParams.get('status')?.toUpperCase();
      return json(200, store.filter((r) => !wanted || r.status === wanted).sort((a, b) => b.id - a.id));
    }
    if (m[2] && method === 'POST') {
      const request = store.find((r) => r.id === Number(m[2]));
      if (!request) return problem(404, 'Verification request not found');
      if (request.status !== 'PENDING') return problem(409, 'This request was already reviewed');
      const note = String(readBody().note ?? '').trim();
      if (m[3] === 'reject' && !note) return problem(400, 'A reason is required to reject a request');
      Object.assign(request, { status: m[3] === 'approve' ? 'APPROVED' : 'REJECTED', reviewNote: note || null, reviewedAt: now() });
      if (m[3] === 'approve') { const inst = activeInst(request.institutionId); if (inst) inst.verified = true; }
      return json(200, request);
    }
  }

  return undefined;
}
