#!/usr/bin/env node
/**
 * Kixi mock API — a local stand-in for the Spring Boot backend (creative-mode/kixi, services/backend-api).
 *
 * It follows the real contracts (paths, DTO shapes, soft delete / trash / restore / purge, RFC 9457 errors,
 * HS256 JWT with `sub` + `roles`, and the role rules from SecurityConfig), so the front can be developed
 * and tested without Postgres + Java. Data lives in memory; it is reset on every start.
 *
 *   node scripts/mock-api.mjs            # http://localhost:8080
 *   PORT=8081 JWT_SECRET=... node scripts/mock-api.mjs
 *
 * Seed accounts (password for all: Kixi1234!):  admin · professor · 12345 (aluno)
 */
import http from 'node:http';
import crypto from 'node:crypto';

const PORT = Number(process.env.PORT ?? 8080);
const SECRET = process.env.JWT_SECRET ?? 'default-secret-change-in-production-min-256-bits';
const SEED_PASSWORD = 'Kixi1234!';

// ── tiny JWT (HS256) ────────────────────────────────────────────────────────
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
const seq = {};
const nextId = (t) => (seq[t] = (seq[t] ?? 0) + 1);
const db = {
  roles: [], accounts: [], users: [], accountRoles: [], 'school-years': [], terms: [], subjects: [], courses: [],
  classes: [], statements: [], simulations: [], 'simulation-answers': [],
};
function add(table, data) {
  const t = now();
  const row = { id: nextId(table), ...data, createdAt: t, updatedAt: t, deletedAt: null };
  db[table].push(row);
  return row;
}

for (const [name, description] of [
  ['ADMIN', 'System administrator with full access'],
  ['TEACHER', 'Teacher with access to create and manage statements'],
  ['STUDENT', 'Student with access to view statements and take simulations'],
]) add('roles', { name, description });
const roleId = (n) => db.roles.find((r) => r.name === n).id;

function seedAccount(username, email, roleName, firstName, lastName) {
  const a = add('accounts', { username, email, passwordHash: hash(SEED_PASSWORD), emailVerified: true, active: true, lastLogin: null });
  db.accountRoles.push({ accountId: a.id, roleId: roleId(roleName) });
  add('users', { accountId: a.id, firstName, lastName, photo: null });
  return a;
}
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

// ── http helpers ────────────────────────────────────────────────────────────
function send(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(body === undefined ? '' : JSON.stringify(body));
}
const problem = (res, status, detail) => send(res, status, { type: null, title: null, status, detail, properties: null });
async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString();
  try { return raw ? JSON.parse(raw) : {}; } catch { return {}; }
}
const strip = (row) => {
  if (!row) return row;
  const { passwordHash, ...rest } = row;
  return rest;
};
const missing = (body, fields) => fields.filter((f) => body[f] === undefined || body[f] === null || body[f] === '');

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
  roles: { table: 'roles', admin: true, req: ['name'], pick: (b) => ({ name: b.name, description: b.description ?? null }) },
  users: { table: 'users', admin: true, req: ['accountId', 'firstName', 'lastName'], pick: (b) => ({ accountId: b.accountId, firstName: b.firstName, lastName: b.lastName, photo: b.photo ?? null }) },
  accounts: {
    table: 'accounts', admin: true, req: ['username', 'email', 'password'],
    pick: (b) => ({ username: String(b.username).trim(), email: String(b.email).trim().toLowerCase(), passwordHash: hash(b.password) }),
    defaults: { emailVerified: false, active: true, lastLogin: null },
    unique: (b, id) => db.accounts.some((a) => !a.deletedAt && a.id !== id && (a.username === String(b.username).trim() || a.email === String(b.email).trim().toLowerCase())) ? 'Username or email already exists' : null,
  },
};

function authorize(req, auth, method, path) {
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
add('simulations', { accountId: student.id, statementId: 1, schoolYearId: sy.id, startedAt: now(), finishedAt: now(), timeSpentSeconds: 3120, finalScore: 15.5, status: 'COMPLETED' });

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const path = url.pathname.replace(/\/+$/, '') || '/';
  const method = req.method;
  if (method === 'OPTIONS') return send(res, 204);
  if (path === '/actuator/health') return send(res, 200, { status: 'UP' });

  const header = req.headers.authorization ?? '';
  const auth = header.startsWith('Bearer ') ? verify(header.slice(7)) : null;
  const status = authorize(req, auth, method, path);
  if (status !== 200) return problem(res, status, status === 401 ? 'Unauthorized' : 'Forbidden');
  const isStaff = (auth?.roles ?? []).some((r) => r === 'ADMIN' || r === 'TEACHER');

  const loginResponse = (acc) => {
    const roles = db.accountRoles.filter((r) => r.accountId === acc.id).map((r) => db.roles.find((x) => x.id === r.roleId)?.name).filter(Boolean);
    const exp = Math.floor(Date.now() / 1000) + 86400;
    return { accessToken: sign({ sub: String(acc.id), roles, iat: Math.floor(Date.now() / 1000), exp }), tokenType: 'Bearer', expiresAt: new Date(exp * 1000).toISOString(), accountId: acc.id, roles };
  };

  try {
    // ── auth ──
    if (path === '/api/v1/auth/login' && method === 'POST') {
      const b = await readBody(req);
      const m = missing(b, ['usernameOrEmail', 'password']);
      if (m.length) return problem(res, 400, `${m.join(', ')} is required`);
      const key = String(b.usernameOrEmail).trim();
      const acc = db.accounts.find((a) => !a.deletedAt && (a.username === key || a.email === key.toLowerCase()));
      if (!acc || acc.passwordHash !== hash(b.password)) return problem(res, 400, 'Invalid username or password');
      if (!acc.active) return problem(res, 400, 'Account is inactive');
      acc.lastLogin = now();
      return send(res, 200, loginResponse(acc));
    }
    if (path === '/api/v1/auth/register' && method === 'POST') {
      const b = await readBody(req);
      const m = missing(b, ['username', 'email', 'password', 'firstName', 'lastName']);
      if (m.length) return problem(res, 400, `${m.join(', ')} is required`);
      if (String(b.password).length < 8) return problem(res, 400, 'Password must be at least 8 characters');
      const username = String(b.username).trim();
      const email = String(b.email).trim().toLowerCase();
      if (db.accounts.some((a) => !a.deletedAt && (a.username === username || a.email === email))) return problem(res, 409, 'Username or email already exists');
      const acc = add('accounts', { username, email, passwordHash: hash(b.password), emailVerified: false, active: true, lastLogin: now() });
      db.accountRoles.push({ accountId: acc.id, roleId: roleId('STUDENT') });
      add('users', { accountId: acc.id, firstName: String(b.firstName).trim(), lastName: String(b.lastName).trim(), photo: null });
      return send(res, 201, loginResponse(acc));
    }

    // ── account roles ──
    let m = path.match(/^\/api\/v1\/accounts\/(\d+)\/roles(?:\/(\d+))?$/);
    if (m) {
      const accountId = Number(m[1]);
      if (method === 'GET') {
        return send(res, 200, db.accountRoles.filter((r) => r.accountId === accountId).map((r) => db.roles.find((x) => x.id === r.roleId)));
      }
      const rid = Number(m[2]);
      if (method === 'POST') {
        if (!db.accountRoles.some((r) => r.accountId === accountId && r.roleId === rid)) db.accountRoles.push({ accountId, roleId: rid });
        return send(res, 204);
      }
      if (method === 'DELETE') {
        db.accountRoles = db.accountRoles.filter((r) => !(r.accountId === accountId && r.roleId === rid));
        return send(res, 204);
      }
    }
    if ((m = path.match(/^\/api\/v1\/users\/(\d+)\/with-account$/)) && method === 'GET') {
      const u = db.users.find((x) => x.id === Number(m[1]) && !x.deletedAt);
      if (!u) return problem(res, 404, 'User not found');
      const a = db.accounts.find((x) => x.id === u.accountId);
      const { accountId, ...rest } = u;
      return send(res, 200, { ...rest, account: a ? { id: a.id, username: a.username, email: a.email } : null });
    }

    // ── statements (moderation) ──
    if (path === '/api/v1/statements/stats' && method === 'GET') {
      const act = db.statements.filter((s) => !s.deletedAt);
      return send(res, 200, { total: act.length, needingReview: act.filter((s) => s.needsReview).length, fromOcr: act.filter((s) => s.source === 'OCR').length, visible: act.filter((s) => s.visible).length });
    }
    if (path === '/api/v1/statements' && method === 'GET') {
      return send(res, 200, db.statements.filter((s) => !s.deletedAt && (isStaff || s.visible)).map(mapStatement));
    }
    for (const [p, f] of [['review', (s) => s.needsReview], ['from-ocr', (s) => s.source === 'OCR']]) {
      if (path === `/api/v1/statements/${p}` && method === 'GET') return send(res, 200, db.statements.filter((s) => !s.deletedAt && f(s)).map(mapStatement));
    }
    if (path === '/api/v1/statements/trash' && method === 'GET') return send(res, 200, db.statements.filter((s) => s.deletedAt).map(mapStatement));
    if ((m = path.match(/^\/api\/v1\/statements\/(\d+)(\/full|\/approve|\/visibility|\/restore|\/purge)?$/))) {
      const id = Number(m[1]);
      const s = db.statements.find((x) => x.id === id);
      const sub = m[2];
      if (!s) return problem(res, 404, 'Statement not found');
      if (!sub && method === 'GET') return s.deletedAt || (!isStaff && !s.visible) ? problem(res, 404, 'Statement not found') : send(res, 200, mapStatement(s));
      if (sub === '/full' && method === 'GET') return s.deletedAt || (!isStaff && !s.visible) ? problem(res, 404, 'Statement not found') : send(res, 200, s);
      if (!sub && method === 'DELETE') { s.deletedAt = now(); return send(res, 204); }
      if (sub === '/restore' && method === 'POST') { s.deletedAt = null; return send(res, 204); }
      if (sub === '/purge' && method === 'DELETE') { db.statements = db.statements.filter((x) => x.id !== id); return send(res, 204); }
      if (sub === '/approve' && method === 'POST') { s.needsReview = false; return send(res, 200, mapStatement(s)); }
      if (sub === '/visibility' && method === 'PATCH') { s.visible = url.searchParams.get('visible') === 'true'; return send(res, 200, mapStatement(s)); }
    }

    // ── simulations (note: /api/simulations, restore is PUT, purge is /permanent) ──
    if ((m = path.match(/^\/api\/simulations(?:\/(trash|\d+)(?:\/(restore|permanent))?)?$/))) {
      const t = m[1];
      const list = (del) => db.simulations.filter((s) => (del ? s.deletedAt : !s.deletedAt) && (isStaff || s.accountId === Number(auth.sub))).map(mapSimulation);
      if (!t && method === 'GET') return send(res, 200, list(false));
      if (t === 'trash' && method === 'GET') return send(res, 200, list(true));
      if (!t && method === 'POST') {
        const b = await readBody(req);
        const r = add('simulations', { accountId: b.accountId ?? Number(auth.sub), statementId: b.statementId, schoolYearId: b.schoolYearId ?? null, startedAt: b.startedAt ?? now(), finishedAt: b.finishedAt ?? null, timeSpentSeconds: b.timeSpentSeconds ?? 0, finalScore: b.finalScore ?? null, status: b.status ?? 'IN_PROGRESS' });
        return send(res, 201, mapSimulation(r));
      }
      const sim = db.simulations.find((x) => x.id === Number(t));
      if (!sim) return problem(res, 404, 'Simulation not found');
      if (!m[2] && method === 'GET') return send(res, 200, mapSimulation(sim));
      if (!m[2] && method === 'DELETE') { sim.deletedAt = now(); return send(res, 204); }
      if (m[2] === 'restore' && method === 'PUT') { sim.deletedAt = null; return send(res, 204); }
      if (m[2] === 'permanent' && method === 'DELETE') { db.simulations = db.simulations.filter((x) => x !== sim); return send(res, 204); }
    }

    // ── generic CRUD (/api/v1/<resource>) ──
    m = path.match(/^\/api\/v1\/([a-z-]+)(?:\/(trash|active|[^/]+?))?(?:\/(restore|purge|login))?$/);
    const def = m && RES[m[1]];
    if (def) {
      const keyField = def.key ?? 'id';
      const rows = db[def.table];
      const seg = m[2];
      const act = m[3];
      const out = (r) => (def.table === 'accounts' ? strip(r) : r);
      if (!seg && method === 'GET') return send(res, 200, rows.filter((r) => !r.deletedAt).map(out));
      if (seg === 'trash' && method === 'GET') return send(res, 200, rows.filter((r) => r.deletedAt).map(out));
      if (seg === 'active' && def.table === 'accounts' && method === 'GET') return send(res, 200, rows.filter((r) => !r.deletedAt && r.active === (url.searchParams.get('active') !== 'false')).map(out));
      if (!seg && method === 'POST') {
        if (def.readOnly) return problem(res, 405, 'Method not allowed');
        const b = await readBody(req);
        const miss = missing(b, def.req);
        if (miss.length) return problem(res, 400, `${miss.join(', ')} is required`);
        const err = def.validate?.(b) ?? def.unique?.(b, null);
        if (err) return problem(res, def.unique ? 409 : 400, err);
        if (def.key && rows.some((r) => !r.deletedAt && r[def.key] === b[def.key])) return problem(res, 409, `${def.key} already exists`);
        return send(res, 201, out(add(def.table, { ...(def.defaults ?? {}), ...def.pick(b) })));
      }
      const row = rows.find((r) => String(r[keyField]) === decodeURIComponent(seg ?? ''));
      if (!row) return problem(res, 404, `${m[1]} not found`);
      if (!act && method === 'GET') return row.deletedAt ? problem(res, 404, `${m[1]} not found`) : send(res, 200, out(row));
      if (!act && method === 'PUT') {
        if (def.noUpdate || def.readOnly) return problem(res, 405, 'Method not allowed');
        const b = await readBody(req);
        const miss = missing(b, def.req);
        if (miss.length) return problem(res, 400, `${miss.join(', ')} is required`);
        const err = def.validate?.(b) ?? def.unique?.(b, row.id);
        if (err) return problem(res, def.unique ? 409 : 400, err);
        Object.assign(row, def.pick(b), { updatedAt: now() });
        return send(res, 200, out(row));
      }
      if (!act && method === 'DELETE') { row.deletedAt = now(); return send(res, 204); }
      if (act === 'restore' && method === 'POST') { row.deletedAt = null; return send(res, 204); }
      if (act === 'purge' && method === 'DELETE') { db[def.table] = rows.filter((r) => r !== row); return send(res, 204); }
      if (act === 'login' && method === 'POST') { row.lastLogin = now(); return send(res, 200, out(row)); }
    }
    return problem(res, 404, `No route for ${method} ${path}`);
  } catch (e) {
    console.error(e);
    return problem(res, 500, 'Internal error');
  }
});

server.listen(PORT, () => console.log(`Kixi mock API on http://localhost:${PORT}  (admin / professor / 12345 · ${SEED_PASSWORD})`));
