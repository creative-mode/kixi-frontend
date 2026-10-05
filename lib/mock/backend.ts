// @ts-nocheck
import 'server-only';
// In-process stand-in for the Spring Boot backend: the manager runs with no network and no database.
// Same contracts as scripts/mock-api.mjs (paths, DTOs, soft delete, HS256 JWT). State lives in memory per server process.
/* eslint-disable @typescript-eslint/no-explicit-any */
import crypto from 'node:crypto';

const PORT = 0;
const SECRET = process.env.JWT_SECRET || 'default-secret-change-in-production-min-256-bits';
const SEED_PASSWORD = 'Kixi1234!';


const b64 = (b) => Buffer.from(b).toString('base64url');
function sign(payload) {
  const h = b64(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const p = b64(JSON.stringify(payload));
  const s = crypto.createHmac('sha256', SECRET).update(`${h}.${p}`).digest('base64url');
  return `${h}.${p}.${s}`;
}
function verify(token) {
  const [h, p, s] = token.split('.');
  if (!h || !p || !s) return null;
  const expect = crypto.createHmac('sha256', SECRET).update(`${h}.${p}`).digest('base64url');
  if (s !== expect) return null;
  const payload = JSON.parse(Buffer.from(p, 'base64url').toString());
  if (payload.exp && Date.now() / 1000 > payload.exp) return null;
  return payload;
}
const hash = (pw) => crypto.createHash('sha256').update(`kixi:${pw}`).digest('hex');

// ── store ───────────────────────────────────────────────────────────────────
const now = () => new Date().toISOString().slice(0, 19);
const G: any = globalThis;
G.__kixiMock ??= { seq: {}, db: null, seeded: false };
const seq = G.__kixiMock.seq;
const nextId = (t) => (seq[t] = (seq[t] ?? 0) + 1);
G.__kixiMock.db ??= {
  roles: [], accounts: [], users: [], accountRoles: [], 'school-years': [], terms: [], subjects: [], courses: [],
  classes: [], statements: [], simulations: [], 'simulation-answers': [], sessions: [], 'question-images': [],
};
const db: any = G.__kixiMock.db;
function add(table, data) {
  const t = now();
  const row = { id: nextId(table), ...data, createdAt: t, updatedAt: t, deletedAt: null };
  db[table].push(row);
  return row;
}

const roleId = (n) => db.roles.find((r) => r.name === n).id;
function seedAccount(username, email, roleName, firstName, lastName) {
  const a = add('accounts', { username, email, passwordHash: hash(SEED_PASSWORD), emailVerified: true, active: true, lastLogin: null });
  db.accountRoles.push({ accountId: a.id, roleId: roleId(roleName) });
  add('users', { accountId: a.id, firstName, lastName, photo: null });
  return a;
}
if (!G.__kixiMock.seeded) {
  G.__kixiMock.seeded = true;
for (const [name, description] of [
  ['ADMIN', 'System administrator with full access'],
  ['TEACHER', 'Teacher with access to create and manage statements'],
  ['STUDENT', 'Student with access to view statements and take simulations'],
]) add('roles', { name, description });

seedAccount('admin', 'admin@kixi.ao', 'ADMIN', 'Administrador', 'Kixi');
seedAccount('professor', 'professor@kixi.ao', 'TEACHER', 'Helena', 'Gomes');
const student = seedAccount('12345', 'aluno@kixi.ao', 'STUDENT', 'Abner', 'Ede');

const sy = add('school-years', { startYear: 2025, endYear: 2026 });
add('school-years', { startYear: 2024, endYear: 2025 });
for (const [number, name] of [[1, '1.º Trimestre'], [2, '2.º Trimestre'], [3, '3.º Trimestre']]) add('terms', { number, name });
const redes = add('subjects', { code: 'RED', name: 'Redes de Computadores', short_name: 'Redes' });
add('subjects', { code: 'SO', name: 'Sistemas Operativos', short_name: 'SO' });
add('subjects', { code: 'MD', name: 'Matemática Discreta', short_name: 'MD' });
const crs = add('courses', { code: 'TISM', name: 'Técnico de Informática e Sistemas Multimédia', description: 'Curso técnico do ITEL' });
const cls = add('classes', { code: '12B', grade: 12, course: crs, schoolYear: sy });
for (const [title, examType, variant, subj] of [['P1 · Redes de Computadores', 'P1', 'A', redes], ['P2 · Sistemas Operativos', 'P2', 'A', db.subjects[1]], ['Exame · Matemática Discreta', 'EXAME', 'B', db.subjects[2]]]) {
  add('statements', {
    title, examType, durationMinutes: 90, variant, instructions: 'Leia atentamente.', totalMaxScore: 20, visible: true, needsReview: false,
    source: 'MANUAL', ocrConfidence: null, ocrRequestId: null, schoolYearId: sy.id, termId: 1, subjectId: subj.id, classId: cls.id, questions: [],
  });
}
add('statements', {
  title: 'P1 · POO (a rever)', examType: 'P1', durationMinutes: 60, variant: null, instructions: null, totalMaxScore: 20, visible: false, needsReview: true,
  source: 'OCR', ocrConfidence: 0.87, ocrRequestId: 'req-1', schoolYearId: sy.id, termId: 2, subjectId: 1, classId: cls.id, questions: [],
});

  seedExtras();
}

// ── http helpers ────────────────────────────────────────────────────────────
function json(status: number, body?: unknown) {
  if (status === 204 || body === undefined) return new Response(null, { status });
  return Response.json(body, { status });
}
const problem = (status: number, detail: string) => json(status, { type: null, title: null, status, detail, properties: null });
const strip = (row: any) => {
  if (!row) return row;
  const { passwordHash, ...rest } = row;
  return rest;
};
const missing = (body: any, fields: string[]) => fields.filter((f: string) => body[f] === undefined || body[f] === null || body[f] === '');

// resource definitions: table, id field (id | code), required request fields, response mapper, optional update
const RES = {
  'school-years': { table: 'school-years', req: ['startYear', 'endYear'], pick: (b) => ({ startYear: b.startYear, endYear: b.endYear }) },
  terms: { table: 'terms', req: ['name', 'number'], pick: (b) => ({ name: b.name, number: b.number }) },
  courses: { table: 'courses', req: ['code', 'name'], pick: (b) => ({ code: b.code, name: b.name, description: b.description ?? null }) },
  subjects: { table: 'subjects', key: 'code', req: ['code', 'name'], pick: (b) => ({ code: b.code, name: b.name, short_name: b.short_name ?? null }) },
  classes: {
    table: 'classes', req: ['code', 'grade', 'courseId', 'schoolYearId'], noUpdate: true,
    pick: (b) => ({ code: b.code, grade: b.grade, course: db.courses.find((c) => c.id === b.courseId), schoolYear: db['school-years'].find((s) => s.id === b.schoolYearId) }),
    validate: (b) => (!db.courses.find((c) => c.id === b.courseId) ? 'course not found' : !db['school-years'].find((s) => s.id === b.schoolYearId) ? 'school year not found' : null),
  },
  sessions: {
    table: 'sessions', admin: true, req: ['accountId', 'token', 'ipAddress'],
    pick: (b) => ({ accountId: b.accountId, token: b.token, ipAddress: b.ipAddress, expiresAt: b.expiresAt ?? null }),
    defaults: { lastUsed: null },
    validate: (b) => (!db.accounts.find((a) => a.id === b.accountId && !a.deletedAt) ? 'account not found' : null),
  },
  'simulation-answers': {
    table: 'simulation-answers', req: ['simulationId', 'questionId'],
    pick: (b) => {
      const sim = db.simulations.find((x) => x.id === b.simulationId);
      const q = db.statements.find((x) => x.id === sim?.statementId)?.questions.find((x) => x.id === b.questionId);
      const opt = q?.options?.find((o) => o.id === b.selectedOptionId);
      return {
        simulationId: b.simulationId, questionId: b.questionId, selectedOptionId: b.selectedOptionId ?? null, answerText: b.answerText ?? null, answeredAt: b.answeredAt ?? now(),
        isCorrect: opt ? !!opt.isCorrect : null, scoreObtained: opt ? (opt.isCorrect ? Number(q.maxScore ?? 1) : 0) : null,
      };
    },
    validate: (b) => (!db.simulations.find((x) => x.id === b.simulationId && !x.deletedAt) ? 'simulation not found' : null),
  },
  roles: { table: 'roles', admin: true, req: ['name'], pick: (b) => ({ name: b.name, description: b.description ?? null }) },
  users: { table: 'users', admin: true, req: ['accountId', 'firstName', 'lastName'], pick: (b) => ({ accountId: b.accountId, firstName: b.firstName, lastName: b.lastName, photo: b.photo ?? null }) },
  accounts: {
    table: 'accounts', admin: true, req: ['username', 'email', 'password'],
    pick: (b) => ({ username: String(b.username).trim(), email: String(b.email).trim().toLowerCase(), passwordHash: hash(b.password) }),
    defaults: { emailVerified: false, active: true, lastLogin: null },
    unique: (b, id) => db.accounts.some((a) => !a.deletedAt && a.id !== id && (a.username === String(b.username).trim() || a.email === String(b.email).trim().toLowerCase())) ? 'Username or email already exists' : null,
  },
};

function authorize(auth: any, method: string, path: string) {
  const roles = auth?.roles ?? [];
  const has = (...r) => r.some((x) => roles.includes(x));
  if (path.startsWith('/api/v1/auth/')) return 200;
  if (!auth) return 401;
  if (/^\/api\/v1\/(accounts|users|roles|sessions)(\/|$)/.test(path)) return has('ADMIN') ? 200 : 403;
  if (method === 'GET') {
    if (/^\/api\/v1\/statements\/(review|from-ocr|trash|stats)$/.test(path) || /\/trash$/.test(path)) return has('ADMIN', 'TEACHER') ? 200 : 403;
    return 200;
  }
  if (/^\/api\/(v1\/)?simulations/.test(path) && method !== 'DELETE' && !/restore/.test(path)) return has('ADMIN', 'TEACHER', 'STUDENT') ? 200 : 403;
  return has('ADMIN', 'TEACHER') ? 200 : 403;
}

function mapStatement(s) {
  const { questions, instructions, ocrRequestId, ...summary } = s;
  return summary;
}
function mapSimulation(s) {
  const acc = db.accounts.find((a) => a.id === s.accountId);
  const st = db.statements.find((x) => x.id === s.statementId);
  return {
    ...s,
    accountId: undefined,
    statementId: undefined,
    account: acc ? { id: acc.id, username: acc.username, email: acc.email } : null,
    statement: st ? { id: st.id, examType: st.examType, variant: st.variant, title: st.title, durationMinutes: st.durationMinutes, totalMaxScore: st.totalMaxScore } : null,
    schoolYear: db['school-years'].find((y) => y.id === s.schoolYearId) ?? null,
  };
}

export async function handle(method: string, rawUrl: string, authorization: string | null, bodyText: string): Promise<Response> {
  const url = new URL(rawUrl, 'http://x');
  const path = url.pathname.replace(/\/+$/, '') || '/';
  if (method === 'OPTIONS') return json(204);
  if (path === '/actuator/health') return json(200, { status: 'UP' });

  const header = authorization ?? '';
  const auth = header.startsWith('Bearer ') ? verify(header.slice(7)) : null;
  const status = authorize(auth, method, path);
  if (status !== 200) return problem(status, status === 401 ? 'Unauthorized' : 'Forbidden');
  const readBody = (): any => { try { return bodyText ? JSON.parse(bodyText) : {}; } catch { return {}; } };
  const isStaff = (auth?.roles ?? []).some((r) => r === 'ADMIN' || r === 'TEACHER');

  const loginResponse = (acc) => {
    const roles = db.accountRoles.filter((r) => r.accountId === acc.id).map((r) => db.roles.find((x) => x.id === r.roleId)?.name).filter(Boolean);
    const exp = Math.floor(Date.now() / 1000) + 86400;
    return { accessToken: sign({ sub: String(acc.id), roles, iat: Math.floor(Date.now() / 1000), exp }), tokenType: 'Bearer', expiresAt: new Date(exp * 1000).toISOString(), accountId: acc.id, roles };
  };

  try {
    // ── auth ──
    if (path === '/api/v1/auth/login' && method === 'POST') {
      const b = readBody();
      const m = missing(b, ['usernameOrEmail', 'password']);
      if (m.length) return problem(400, `${m.join(', ')} is required`);
      const key = String(b.usernameOrEmail).trim();
      const acc = db.accounts.find((a) => !a.deletedAt && (a.username === key || a.email === key.toLowerCase()));
      if (!acc || acc.passwordHash !== hash(b.password)) return problem(400, 'Invalid username or password');
      if (!acc.active) return problem(400, 'Account is inactive');
      acc.lastLogin = now();
      return json(200, loginResponse(acc));
    }
    if (path === '/api/v1/auth/register' && method === 'POST') {
      const b = readBody();
      const m = missing(b, ['username', 'email', 'password', 'firstName', 'lastName']);
      if (m.length) return problem(400, `${m.join(', ')} is required`);
      if (String(b.password).length < 8) return problem(400, 'Password must be at least 8 characters');
      const username = String(b.username).trim();
      const email = String(b.email).trim().toLowerCase();
      if (db.accounts.some((a) => !a.deletedAt && (a.username === username || a.email === email))) return problem(409, 'Username or email already exists');
      const acc = add('accounts', { username, email, passwordHash: hash(b.password), emailVerified: false, active: true, lastLogin: now() });
      db.accountRoles.push({ accountId: acc.id, roleId: roleId('STUDENT') });
      add('users', { accountId: acc.id, firstName: String(b.firstName).trim(), lastName: String(b.lastName).trim(), photo: null });
      return json(201, loginResponse(acc));
    }

    // ── account roles ──
    let m = path.match(/^\/api\/v1\/accounts\/(\d+)\/roles(?:\/(\d+))?$/);
    if (m) {
      const accountId = Number(m[1]);
      if (method === 'GET') {
        return json(200, db.accountRoles.filter((r) => r.accountId === accountId).map((r) => db.roles.find((x) => x.id === r.roleId)));
      }
      const rid = Number(m[2]);
      if (method === 'POST') {
        if (!db.accountRoles.some((r) => r.accountId === accountId && r.roleId === rid)) db.accountRoles.push({ accountId, roleId: rid });
        return json(204);
      }
      if (method === 'DELETE') {
        db.accountRoles = db.accountRoles.filter((r) => !(r.accountId === accountId && r.roleId === rid));
        return json(204);
      }
    }
    if ((m = path.match(/^\/api\/v1\/users\/(\d+)\/with-account$/)) && method === 'GET') {
      const u = db.users.find((x) => x.id === Number(m[1]) && !x.deletedAt);
      if (!u) return problem(404, 'User not found');
      const a = db.accounts.find((x) => x.id === u.accountId);
      const { accountId, ...rest } = u;
      return json(200, { ...rest, account: a ? { id: a.id, username: a.username, email: a.email } : null });
    }

    // ── statements (moderation) ──
    if (path === '/api/v1/statements/stats' && method === 'GET') {
      const act = db.statements.filter((s) => !s.deletedAt);
      return json(200, { total: act.length, needingReview: act.filter((s) => s.needsReview).length, fromOcr: act.filter((s) => s.source === 'OCR').length, visible: act.filter((s) => s.visible).length });
    }
    if (path === '/api/v1/statements' && method === 'GET') {
      return json(200, db.statements.filter((s) => !s.deletedAt && (isStaff || s.visible)).map(mapStatement));
    }
    for (const [p, f] of [['review', (s) => s.needsReview], ['from-ocr', (s) => s.source === 'OCR']]) {
      if (path === `/api/v1/statements/${p}` && method === 'GET') return json(200, db.statements.filter((s) => !s.deletedAt && f(s)).map(mapStatement));
    }
    if (path === '/api/v1/statements/trash' && method === 'GET') return json(200, db.statements.filter((s) => s.deletedAt).map(mapStatement));
    if ((m = path.match(/^\/api\/v1\/statements\/(\d+)(\/full|\/approve|\/visibility|\/restore|\/purge)?$/))) {
      const id = Number(m[1]);
      const s = db.statements.find((x) => x.id === id);
      const sub = m[2];
      if (!s) return problem(404, 'Statement not found');
      if (!sub && method === 'GET') return s.deletedAt || (!isStaff && !s.visible) ? problem(404, 'Statement not found') : json(200, mapStatement(s));
      if (sub === '/full' && method === 'GET') return s.deletedAt || (!isStaff && !s.visible) ? problem(404, 'Statement not found') : json(200, s);
      if (!sub && method === 'DELETE') { s.deletedAt = now(); return json(204); }
      if (sub === '/restore' && method === 'POST') { s.deletedAt = null; return json(204); }
      if (sub === '/purge' && method === 'DELETE') { db.statements = db.statements.filter((x) => x.id !== id); return json(204); }
      if (sub === '/approve' && method === 'POST') { s.needsReview = false; return json(200, mapStatement(s)); }
      if (sub === '/visibility' && method === 'PATCH') { s.visible = url.searchParams.get('visible') === 'true'; return json(200, mapStatement(s)); }
    }

    // ── question images (multipart upload) ──
    if ((m = path.match(/^\/api\/v1\/question-images\/question\/(\d+)$/)) && method === 'GET') {
      return json(200, db['question-images'].filter((i) => !i.deletedAt && i.questionId === Number(m[1])).sort((a, b) => a.orderIndex - b.orderIndex));
    }
    if (path === '/api/v1/question-images' && method === 'POST') {
      const b = readBody();
      const d = b.data ?? {};
      const f = Array.isArray(b.file) ? b.file[0] : b.file;
      if (!d.questionId) return problem(400, 'Question ID is required');
      if (!f?.dataUrl) return problem(400, 'Image file is required (max 1,5 MB in the mock)');
      if (!String(f.type).startsWith('image/')) return problem(400, 'Only image files are accepted');
      const order = d.orderIndex ?? db['question-images'].filter((i) => !i.deletedAt && i.questionId === d.questionId).length;
      return json(201, add('question-images', { questionId: d.questionId, imageUrl: f.dataUrl, caption: d.caption ?? null, orderIndex: order }));
    }
    if ((m = path.match(/^\/api\/v1\/question-images\/(\d+)$/)) && ['PUT', 'DELETE', 'GET'].includes(method)) {
      const img = db['question-images'].find((i) => i.id === Number(m[1]) && !i.deletedAt);
      if (!img) return problem(404, 'Question image not found');
      if (method === 'GET') return json(200, img);
      if (method === 'DELETE') { img.deletedAt = now(); return json(204); }
      const b = readBody();
      Object.assign(img, { caption: b.caption ?? null, orderIndex: b.orderIndex ?? img.orderIndex, updatedAt: now() });
      return json(200, img);
    }

    // ── OCR import: creates a statement waiting for review ──
    if ((path === '/api/v1/statements/ocr/extract' || path === '/api/v1/statements/ocr/extract/single') && method === 'POST') {
      const b = readBody();
      const files = [b.files ?? b.file].flat().filter(Boolean);
      if (!files.length) return problem(400, 'At least one file is required');
      const title = String(files[0].name ?? 'Prova importada').replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim() || 'Prova importada';
      const sy = db['school-years'][0];
      const s = add('statements', {
        title, examType: 'P1', durationMinutes: 60, variant: null, instructions: null, totalMaxScore: 20, visible: false, needsReview: true,
        source: 'OCR', ocrConfidence: 0.82, ocrRequestId: `req-${Date.now()}`, schoolYearId: sy?.id ?? null, termId: null, subjectId: null, classId: null,
        questions: [1, 2, 3].map((n) => ({ id: 1000 + nextId('questions'), number: n, questionType: 'MULTIPLE_CHOICE', text: `Questão ${n} extraída de ${files.length} ficheiro(s). Reveja o texto.`, maxScore: 2, needsReview: true, options: ['A', 'B', 'C', 'D'].map((l, i) => ({ id: 1000 + nextId('options'), optionLabel: l, optionText: `Opção ${l}`, isCorrect: i === 0 })) })),
      });
      return json(201, s);
    }

    // ── simulations (note: /api/simulations, restore is PUT, purge is /permanent) ──
    if ((m = path.match(/^\/api\/simulations(?:\/(trash|\d+)(?:\/(restore|permanent))?)?$/))) {
      const t = m[1];
      const list = (del) => db.simulations.filter((s) => (del ? s.deletedAt : !s.deletedAt) && (isStaff || s.accountId === Number(auth.sub))).map(mapSimulation);
      if (!t && method === 'GET') return json(200, list(false));
      if (t === 'trash' && method === 'GET') return json(200, list(true));
      if (!t && method === 'POST') {
        const b = readBody();
        const r = add('simulations', { accountId: b.accountId ?? Number(auth.sub), statementId: b.statementId, schoolYearId: b.schoolYearId ?? null, startedAt: b.startedAt ?? now(), finishedAt: b.finishedAt ?? null, timeSpentSeconds: b.timeSpentSeconds ?? 0, finalScore: b.finalScore ?? null, status: b.status ?? 'IN_PROGRESS' });
        return json(201, mapSimulation(r));
      }
      const sim = db.simulations.find((x) => x.id === Number(t));
      if (!sim) return problem(404, 'Simulation not found');
      if (!m[2] && method === 'GET') return json(200, mapSimulation(sim));
      if (!m[2] && method === 'DELETE') { sim.deletedAt = now(); return json(204); }
      if (m[2] === 'restore' && method === 'PUT') { sim.deletedAt = null; return json(204); }
      if (m[2] === 'permanent' && method === 'DELETE') { db.simulations = db.simulations.filter((x) => x !== sim); return json(204); }
    }

    if (path.startsWith('/api/v1/analytics') && method === 'GET') { const a = analytics(path, url); if (a) return a; }

    // ── generic CRUD (/api/v1/<resource>) ──
    m = path.match(/^\/api\/v1\/([a-z-]+)(?:\/(trash|active|[^/]+?))?(?:\/(restore|purge|login))?$/);
    const def = m && RES[m[1]];
    if (def) {
      const keyField = def.key ?? 'id';
      const rows = db[def.table];
      const seg = m[2];
      const act = m[3];
      const out = (r) => (def.table === 'accounts' ? strip(r) : r);
      if (!seg && method === 'GET') return json(200, rows.filter((r) => !r.deletedAt).map(out));
      if (seg === 'trash' && method === 'GET') return json(200, rows.filter((r) => r.deletedAt).map(out));
      if (seg === 'active' && def.table === 'accounts' && method === 'GET') return json(200, rows.filter((r) => !r.deletedAt && r.active === (url.searchParams.get('active') !== 'false')).map(out));
      if (!seg && method === 'POST') {
        if (def.readOnly) return problem(405, 'Method not allowed');
        const b = readBody();
        const miss = missing(b, def.req);
        if (miss.length) return problem(400, `${miss.join(', ')} is required`);
        const err = def.validate?.(b) ?? def.unique?.(b, null);
        if (err) return problem(def.unique ? 409 : 400, err);
        if (def.key && rows.some((r) => !r.deletedAt && r[def.key] === b[def.key])) return problem(409, `${def.key} already exists`);
        return json(201, out(add(def.table, { ...(def.defaults ?? {}), ...def.pick(b) })));
      }
      const row = rows.find((r) => String(r[keyField]) === decodeURIComponent(seg ?? ''));
      if (!row) return problem(404, `${m[1]} not found`);
      if (!act && method === 'GET') return row.deletedAt ? problem(404, `${m[1]} not found`) : json(200, out(row));
      if (!act && method === 'PUT') {
        if (def.noUpdate || def.readOnly) return problem(405, 'Method not allowed');
        const b = readBody();
        const miss = missing(b, def.req);
        if (miss.length) return problem(400, `${miss.join(', ')} is required`);
        const err = def.validate?.(b) ?? def.unique?.(b, row.id);
        if (err) return problem(def.unique ? 409 : 400, err);
        Object.assign(row, def.pick(b), { updatedAt: now() });
        return json(200, out(row));
      }
      if (!act && method === 'DELETE') { row.deletedAt = now(); return json(204); }
      if (act === 'restore' && method === 'POST') { row.deletedAt = null; return json(204); }
      if (act === 'purge' && method === 'DELETE') { db[def.table] = rows.filter((r) => r !== row); return json(204); }
      if (act === 'login' && method === 'POST') { row.lastLogin = now(); return json(200, out(row)); }
    }
    return problem(404, `No route for ${method} ${path}`);
  } catch (e) {
    console.error(e);
    return problem(500, 'Internal error');
  }
}


// ── extra seed + analytics ──────────────────────────────────────────────────
function seedExtras() {
  add('sessions', { accountId: db.accounts[0].id, token: crypto.randomBytes(24).toString('hex'), ipAddress: '41.63.10.22', expiresAt: new Date(Date.now() + 86400000).toISOString().slice(0, 19), lastUsed: now() });
  add('sessions', { accountId: db.accounts[2].id, token: crypto.randomBytes(24).toString('hex'), ipAddress: '41.63.11.7', expiresAt: new Date(Date.now() - 86400000).toISOString().slice(0, 19), lastUsed: null });
  const student = db.accounts.find((a: any) => a.username === '12345');
  const sy = db['school-years'][0];
  add('simulations', { accountId: student.id, statementId: 1, schoolYearId: sy.id, startedAt: now(), finishedAt: now(), timeSpentSeconds: 3120, finalScore: 15.5, status: 'COMPLETED' });
  const opts = (labels: string[], correct: number) => labels.map((t, i) => ({ id: i + 1, optionLabel: 'ABCD'[i], optionText: t, isCorrect: i === correct }));
  const qs = [
    ['Qual é o endereço de broadcast da rede 192.168.10.0/26?', ['192.168.10.31', '192.168.10.63', '192.168.10.64', '192.168.10.127'], 1],
    ['Quantos hosts úteis tem uma sub-rede /27?', ['30', '32', '62', '14'], 0],
    ['Que camada do modelo OSI trata do roteamento?', ['Enlace', 'Rede', 'Transporte', 'Sessão'], 1],
    ['Qual protocolo resolve nomes em endereços IP?', ['DHCP', 'ARP', 'DNS', 'ICMP'], 2],
    ['Para que serve uma VLAN?', ['Aumentar a banda', 'Segmentar a rede logicamente', 'Cifrar tráfego', 'Balancear carga'], 1],
    ['Qual é a máscara de um /24?', ['255.255.0.0', '255.255.255.0', '255.255.255.128', '255.0.0.0'], 1],
  ];
  db.statements.forEach((st: any, si: number) => {
    st.questions = qs.map(([text, o, c]: any, i: number) => ({ id: si * 10 + i + 1, number: i + 1, text, questionType: 'MULTIPLE_CHOICE', maxScore: 20 / qs.length, needsReview: st.needsReview && i === 2, options: opts(o, c) }));
  });
  for (const [qid, opt] of [[1, 2], [2, 1], [3, 2]]) {
    const q = db.statements[0].questions.find((x: any) => x.id === qid);
    const o = q.options.find((x: any) => x.id === opt);
    add('simulation-answers', { simulationId: 1, questionId: qid, selectedOptionId: opt, answerText: null, answeredAt: now(), isCorrect: o.isCorrect, scoreObtained: o.isCorrect ? q.maxScore : 0 });
  }
  for (const [username, first, last] of [['helder', 'Helder', 'Gomes'], ['mariana', 'Mariana', 'Costa'], ['paulo', 'Paulo', 'Neto'], ['sara', 'Sara', 'Pinto']]) seedAccount(username, `${username}@kixi.ao`, 'STUDENT', first, last);
}

const INSTITUTIONS = [
  { id: 1, code: 'ITEL', name: 'Instituto de Telecomunicações', courses: 4, classes: 14, students: 412, finishedSimulations: 1280, averageScorePercent: 74.2, averageTimeSeconds: 3120 },
  { id: 2, code: 'ISPTEC', name: 'Instituto Superior Politécnico de Tecnologias e Ciências', courses: 6, classes: 18, students: 530, finishedSimulations: 960, averageScorePercent: 69.8, averageTimeSeconds: 3480 },
  { id: 3, code: 'IMIL', name: 'Instituto Médio Industrial de Luanda', courses: 3, classes: 9, students: 238, finishedSimulations: 410, averageScorePercent: 66.1, averageTimeSeconds: 2940 },
];

function analytics(path: string, url: URL) {
  const active = db.statements.filter((s: any) => !s.deletedAt);
  if (path === '/api/v1/analytics/overview') {
    return json(200, {
      scope: 'ADMIN', institutions: INSTITUTIONS.length, classes: INSTITUTIONS.reduce((n, i) => n + i.classes, 0),
      students: INSTITUTIONS.reduce((n, i) => n + i.students, 0), teachers: 38,
      statements: { total: active.length, published: active.filter((s: any) => s.visible).length, needingReview: active.filter((s: any) => s.needsReview).length, missingAnswerKey: 1 },
      simulations: { total: 2870, finished: 2650, inProgress: 140, cancelled: 80, uniqueStudents: 904 },
      averageScorePercent: 71.4, passRatePercent: 78.9, averageTimeSeconds: 3240,
    });
  }
  if (path === '/api/v1/analytics/activity') {
    const days = Math.min(Math.max(Number(url.searchParams.get('days') ?? 30), 1), 365);
    const out = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      const weekend = [0, 6].includes(d.getUTCDay());
      const wave = Math.sin((days - i) / 3) * 12 + 40;
      const finished = Math.max(2, Math.round((weekend ? wave * 0.4 : wave) + ((days - i) * 7919) % 11));
      out.push({ date: d.toISOString().slice(0, 10), finished, averageScorePercent: Math.round((66 + Math.sin((days - i) / 5) * 8 + (((days - i) * 31) % 5)) * 10) / 10 });
    }
    return json(200, out);
  }
  if (path === '/api/v1/analytics/institutions') return json(200, INSTITUTIONS);
  if (path === '/api/v1/analytics/classes') {
    return json(200, [
      { id: 1, code: '12B', grade: 12, course: 'Informática e Sistemas Multimédia', institution: 'ITEL', students: 31, teachers: 4, statements: 6, finishedSimulations: 128, averageScorePercent: 76.4, averageTimeSeconds: 3010 },
      { id: 2, code: '12A', grade: 12, course: 'Informática e Sistemas Multimédia', institution: 'ITEL', students: 29, teachers: 4, statements: 5, finishedSimulations: 104, averageScorePercent: 72.9, averageTimeSeconds: 3180 },
      { id: 3, code: '11C', grade: 11, course: 'Redes e Telecomunicações', institution: 'ISPTEC', students: 34, teachers: 3, statements: 4, finishedSimulations: 88, averageScorePercent: 64.2, averageTimeSeconds: 3600 },
      { id: 4, code: '13A', grade: 13, course: 'Eletrónica', institution: 'IMIL', students: 26, teachers: 3, statements: 3, finishedSimulations: 52, averageScorePercent: 58.7, averageTimeSeconds: 2880 },
    ]);
  }
  let m = path.match(/^\/api\/v1\/analytics\/statements\/(\d+)\/questions$/);
  if (m) {
    const st = active.find((s: any) => s.id === Number(m[1]));
    if (!st) return problem(404, 'Statement not found');
    return json(200, st.questions.map((q: any, i: number) => {
      const attempts = 40 + i * 3;
      const correct = Math.round(attempts * (0.9 - i * 0.12));
      return { id: q.id, number: q.number, text: q.text, questionType: q.questionType, maxScore: q.maxScore, attempts, answered: attempts - 2, correct, correctPercent: Math.round((correct / attempts) * 1000) / 10 };
    }));
  }
  if (path === '/api/v1/analytics/statements') {
    const limit = Number(url.searchParams.get('limit') ?? 50);
    return json(200, active.slice(0, limit).map((s: any, i: number) => ({
      id: s.id, title: s.title, examType: s.examType, classCode: '12B', subject: db.subjects.find((x: any) => x.id === s.subjectId)?.short_name ?? null,
      published: s.visible, needsReview: s.needsReview, answerKeyComplete: !s.needsReview, questions: s.questions.length,
      finishedSimulations: 60 - i * 11, uniqueStudents: 44 - i * 8, averageScorePercent: [78.2, 71.5, 64.9, null][i] ?? 70, passRatePercent: [88.6, 79.1, 66.7, null][i] ?? 70, averageTimeSeconds: 3100 + i * 240,
    })));
  }
  return null;
}
