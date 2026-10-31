/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import 'server-only';
// In-process stand-in for the Spring Boot backend: the manager runs with no network and no database.
// Same contracts as scripts/mock-api.mjs (paths, DTOs, soft delete, HS256 JWT). State lives in memory per server process.
/* eslint-disable @typescript-eslint/no-explicit-any */
import crypto from 'node:crypto';
import { getJwtSecretValue } from '../dev-secret';
import { examRooms, luandaClock } from './exam-rooms';
import { assignmentsFrom, teacherCanWrite } from '../crud/teacher-scope';
import { canWriteProblem } from './statement-write';
import { validateAssignment, type AcademicWorld } from './academic';

export const SEED_PASSWORD = 'Kixi1234!';


export const b64 = (b) => Buffer.from(b).toString('base64url');
export function sign(payload) {
  const h = b64(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const p = b64(JSON.stringify(payload));
  const s = crypto.createHmac('sha256', getJwtSecretValue()).update(`${h}.${p}`).digest('base64url');
  return `${h}.${p}.${s}`;
}
export function verify(token) {
  const [h, p, s] = token.split('.');
  if (!h || !p || !s) return null;
  const expect = crypto.createHmac('sha256', getJwtSecretValue()).update(`${h}.${p}`).digest('base64url');
  if (s !== expect) return null;
  const payload = JSON.parse(Buffer.from(p, 'base64url').toString());
  if (payload.exp && Date.now() / 1000 > payload.exp) return null;
  return payload;
}
export const hash = (pw) => crypto.createHash('sha256').update(`kixi:${pw}`).digest('hex');

// ── store ───────────────────────────────────────────────────────────────────
export const now = () => new Date().toISOString().slice(0, 19);
export const G: any = globalThis;
G.__kixiMock ??= { seq: {}, db: null, seeded: false };
G.__kixiMock.ocrJobs ??= new Map();
export const seq = G.__kixiMock.seq;
export const nextId = (t) => (seq[t] = (seq[t] ?? 0) + 1);
G.__kixiMock.db ??= {
  roles: [], accounts: [], users: [], accountRoles: [], 'school-years': [], terms: [], subjects: [], courses: [],
  classes: [], statements: [], simulations: [], 'simulation-answers': [], sessions: [], 'question-images': [],
  'integrity-events': [],
  institutions: [], teachers: [], institutionSubjects: [], institutionTeachers: [], institutionStudents: [],
  enrollments: [], 'teaching-assignments': [], courseSubjects: [], enrollmentCodes: [],
};
export const db: any = G.__kixiMock.db;
export function add(table, data) {
  const t = now();
  const row = { id: nextId(table), ...data, createdAt: t, updatedAt: t, deletedAt: null };
  db[table].push(row);
  return row;
}

export const roleId = (n) => db.roles.find((r) => r.name === n).id;

// Salas de Prova: regras em ./exam-rooms.ts, com testes.
export const rooms = examRooms({
  db,
  add,
  clock: luandaClock,
  // StatementWriteAccessService.checkCanWrite, com as atribuições do professor.
  canWriteStatement: (statementId, accountId, admin) => {
    if (admin) return true;
    const st = db.statements.find((x) => x.id === statementId && !x.deletedAt);
    const teacher = db.teachers.find((t) => t.accountId === accountId && !t.deletedAt);
    if (!st || !teacher) return false;
    return teacherCanWrite(assignmentsFrom(db['teaching-assignments'].filter((a) => a.teacherId === teacher.id)), st);
  },
  isStudent: (accountId) => db.accountRoles.some((r) => r.accountId === accountId && r.roleId === roleId('STUDENT')),
});
export function seedAccount(username, email, roleName, firstName, lastName) {
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
const teacherAcc = db.accounts.find((a) => a.username === 'professor');

const sy = add('school-years', { startYear: 2025, endYear: 2026 });
add('school-years', { startYear: 2024, endYear: 2025 });
for (const [number, name] of [[1, '1.º Trimestre'], [2, '2.º Trimestre'], [3, '3.º Trimestre']]) add('terms', { number, name });
const redes = add('subjects', { code: 'RED', name: 'Redes de Computadores', short_name: 'Redes' });
add('subjects', { code: 'SO', name: 'Sistemas Operativos', short_name: 'SO' });
add('subjects', { code: 'MD', name: 'Matemática Discreta', short_name: 'MD' });
// A disciplina da prova de OGI: o OCR lê a sigla «OGI» e o construtor tem de a encontrar por aqui.
const ogi = add('subjects', { code: 'OGI', name: 'Organização e Gestão Industrial', short_name: 'OGI' });
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

  const itel = add('institutions', { code: 'ITEL', name: 'Instituto de Telecomunicações', short_name: 'ITEL', logo: '/manager/exam/itel.png' });
  // A escola da turma é herdada do curso (como no backend): o seed liga-os aqui.
  crs.institutionId = itel.id;
  cls.institutionId = itel.id;
  for (const sub of db.subjects) db.institutionSubjects.push({ institutionId: itel.id, subjectId: sub.id });
  cls.institutionId = itel.id;
  // Currículo do ITEL: as disciplinas atuais valem para todas as classes do curso.
  for (const sub of db.subjects) add('courseSubjects', { courseId: crs.id, subjectId: sub.id, grade: null });
  // Segunda escola, com um curso de MESMO código (único só por escola) e a disciplina Redes em comum.
  const imil = add('institutions', { code: 'IMIL', name: 'Instituto Médio Industrial de Luanda', short_name: 'IMIL', logo: null });
  const imilCrs = add('courses', { code: 'TISM', name: 'Técnico de Informática (IMIL)', description: 'Curso técnico do IMIL', institutionId: imil.id });
  const imilCls = add('classes', { code: '10A', grade: 10, course: imilCrs, schoolYear: sy, institutionId: imil.id });
  for (const sub of [redes, db.subjects[2]]) {
    add('courseSubjects', { courseId: imilCrs.id, subjectId: sub.id, grade: null });
    db.institutionSubjects.push({ institutionId: imil.id, subjectId: sub.id });
  }
  const helena = add('teachers', { accountId: teacherAcc.id, firstName: 'Helena', lastName: 'Gomes', email: 'professor@kixi.ao', photo: null, specialty: 'Redes', employeeNumber: 'P-001' });
  db.institutionTeachers.push({ institutionId: itel.id, teacherId: helena.id });
  // A Helena dá aulas nas duas escolas.
  db.institutionTeachers.push({ institutionId: imil.id, teacherId: helena.id });
  add('teaching-assignments', { teacherId: helena.id, classId: imilCls.id, subjectId: redes.id, schoolYearId: sy.id, tutorStyle: null });
  const carlos = add('teachers', { accountId: null, firstName: 'Carlos', lastName: 'Mendes', email: 'carlos@itel.ao', photo: null, specialty: 'Sistemas Operativos', employeeNumber: 'P-002' });
  db.institutionTeachers.push({ institutionId: itel.id, teacherId: carlos.id });
  // Segundo professor com login próprio, para testar o filtro por professor.
  const carlosAcc = add('accounts', { username: 'carlos', email: 'carlos@itel.ao', passwordHash: hash(SEED_PASSWORD), emailVerified: true, active: true, lastLogin: null });
  db.accountRoles.push({ accountId: carlosAcc.id, roleId: roleId('TEACHER') });
  carlos.accountId = carlosAcc.id;
  const stUser = db.users.find((u) => u.accountId === student.id);
  if (stUser) db.institutionStudents.push({ institutionId: itel.id, userId: stUser.id });
  add('enrollments', { accountId: student.id, classId: cls.id, schoolYearId: sy.id, status: 'ACTIVE' });
  add('teaching-assignments', { teacherId: helena.id, classId: cls.id, subjectId: redes.id, schoolYearId: sy.id, tutorStyle: null });
  add('teaching-assignments', { teacherId: helena.id, classId: cls.id, subjectId: ogi.id, schoolYearId: sy.id, tutorStyle: null });
  // Turma e disciplina só do Carlos (11A · Sistemas Operativos), para as listas dele diferirem das da Helena.
  const cls11 = add('classes', { code: '11A', grade: 11, course: crs, schoolYear: sy });
  add('statements', {
    title: 'P1 · Sistemas Operativos (11A)', examType: 'P1', durationMinutes: 90, variant: 'A', instructions: 'Leia atentamente.', totalMaxScore: 20, visible: true, needsReview: false,
    source: 'MANUAL', ocrConfidence: null, ocrRequestId: null, schoolYearId: sy.id, termId: 1, subjectId: db.subjects[1].id, classId: cls11.id, questions: [],
  });
  add('teaching-assignments', { teacherId: carlos.id, classId: cls11.id, subjectId: db.subjects[1].id, schoolYearId: sy.id, tutorStyle: null });

  seedExtras();
}

// ── http helpers ────────────────────────────────────────────────────────────
export function json(status: number, body?: unknown) {
  if (status === 204 || body === undefined) return new Response(null, { status });
  return Response.json(body, { status });
}
export const problem = (status: number, detail: string) => json(status, { type: null, title: null, status, detail, properties: null });
export const strip = (row: any) => {
  if (!row) return row;
  const rest = { ...row };
  delete rest.passwordHash;
  return rest;
};
export const missing = (body: any, fields: string[]) => fields.filter((f: string) => body[f] === undefined || body[f] === null || body[f] === '');

export const academicWorld = (): AcademicWorld => ({
  institutions: db.institutions, courses: db.courses, classes: db.classes, subjects: db.subjects, teachers: db.teachers,
  courseSubjects: db.courseSubjects, institutionSubjects: db.institutionSubjects, institutionTeachers: db.institutionTeachers,
  assignments: db['teaching-assignments'], enrollments: db.enrollments, schoolYears: db['school-years'],
});

// resource definitions: table, id field (id | code), required request fields, response mapper, optional update
export const RES = {
  'school-years': { table: 'school-years', req: ['startYear', 'endYear'], pick: (b) => ({ startYear: b.startYear, endYear: b.endYear }) },
  terms: { table: 'terms', req: ['name', 'number'], pick: (b) => ({ name: b.name, number: b.number }) },
  courses: {
    table: 'courses', req: ['code', 'name', 'institutionId'],
    pick: (b) => ({ code: b.code, name: b.name, description: b.description ?? null, institutionId: Number(b.institutionId) }),
    validate: (b) => (!b.institutionId ? 'school is required' : !db.institutions.find((s) => s.id === Number(b.institutionId) && !s.deletedAt) ? 'school not found' : null),
    // V50: o código do curso é único por escola (antes era global).
    unique: (b, id) => (db.courses.some((c) => !c.deletedAt && c.id !== id && c.institutionId === Number(b.institutionId) && c.code === b.code) ? 'Já existe um curso com este código nesta escola.' : null),
  },
  subjects: { table: 'subjects', key: 'code', req: ['code', 'name'], pick: (b) => ({ code: b.code, name: b.name, short_name: b.short_name ?? null }) },
  classes: {
    table: 'classes', req: ['code', 'grade', 'courseId', 'schoolYearId'],
    pick: (b) => {
      const course = db.courses.find((c) => c.id === b.courseId);
      return { code: b.code, grade: b.grade, course, schoolYear: db['school-years'].find((s) => s.id === b.schoolYearId), institutionId: course?.institutionId ?? null };
    },
    validate: (b) => (!db.courses.find((c) => c.id === b.courseId) ? 'course not found' : !db['school-years'].find((s) => s.id === b.schoolYearId) ? 'school year not found' : null),
    // Mudar o curso, a classe ou o ano de uma turma com matrículas ou professores deixaria os registos incoerentes.
    updateGuard: (b, row) => {
      const changed = b.courseId !== row.course?.id || b.grade !== row.grade || b.schoolYearId !== row.schoolYear?.id;
      const used = db.enrollments.some((e) => !e.deletedAt && e.classId === row.id) || db['teaching-assignments'].some((a) => !a.deletedAt && a.classId === row.id);
      return changed && used ? 'A turma tem matrículas ou professores atribuídos: só o código se pode alterar.' : null;
    },
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
  institutions: { table: 'institutions', req: ['code', 'name'], unique: (b, id) => (db.institutions.some((i) => !i.deletedAt && i.id !== id && i.code === b.code) ? 'Institution code already exists' : null), pick: (b) => ({ code: b.code, name: b.name, short_name: b.short_name ?? null, logo: b.logo ?? null }) },
  teachers: {
    table: 'teachers', admin: true, req: ['firstName', 'lastName'],
    pick: (b) => ({ firstName: b.firstName, lastName: b.lastName, email: b.email ?? null, photo: b.photo ?? null, specialty: b.specialty ?? null, employeeNumber: b.employeeNumber ?? null }),
    defaults: { accountId: null },
  },
  enrollments: {
    table: 'enrollments', req: ['accountId', 'classId', 'schoolYearId'],
    pick: (b) => ({ accountId: Number(b.accountId), classId: Number(b.classId), schoolYearId: Number(b.schoolYearId), status: 'ACTIVE' }),
    validate: (b) => {
      const acc = db.accounts.find((x) => x.id === Number(b.accountId) && !x.deletedAt);
      if (!acc) return 'account not found';
      const roles = db.accountRoles.filter((r) => r.accountId === acc.id).map((r) => db.roles.find((x) => x.id === r.roleId)?.name);
      if (!roles.includes('STUDENT')) return 'enrollment needs an account with the STUDENT role';
      if (!db.classes.find((x) => x.id === Number(b.classId) && !x.deletedAt)) return 'class not found';
      if (!db['school-years'].find((s) => s.id === Number(b.schoolYearId))) return 'school year not found';
      return null;
    },
    // backend: uq_enrollments_account_school_year_active — uma ativa por conta e ano.
    unique: (b, id) => (db.enrollments.some((e) => !e.deletedAt && e.status !== 'CANCELLED' && e.id !== id && e.accountId === Number(b.accountId) && e.schoolYearId === Number(b.schoolYearId)) ? 'Account already has an active enrollment for this school year' : null),
  },
  'teaching-assignments': {
    table: 'teaching-assignments', req: ['teacherId', 'classId', 'subjectId', 'schoolYearId'],
    pick: (b) => ({ teacherId: Number(b.teacherId), classId: Number(b.classId), subjectId: Number(b.subjectId), schoolYearId: Number(b.schoolYearId), tutorStyle: b.tutorStyle || null }),
    rule: (b) => validateAssignment(academicWorld(), b),
    validate: (b) => (!db.teachers.find((x) => x.id === Number(b.teacherId) && !x.deletedAt) ? 'teacher not found' : !db.classes.find((x) => x.id === Number(b.classId) && !x.deletedAt) ? 'class not found' : !db.subjects.find((x) => x.id === Number(b.subjectId) && !x.deletedAt) ? 'subject not found' : !db['school-years'].find((s) => s.id === Number(b.schoolYearId)) ? 'school year not found' : null),
    unique: (b, id) => (db['teaching-assignments'].some((a) => !a.deletedAt && a.id !== id && a.teacherId === Number(b.teacherId) && a.classId === Number(b.classId) && a.subjectId === Number(b.subjectId) && a.schoolYearId === Number(b.schoolYearId)) ? 'Assignment already exists' : null),
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

export function authorize(auth: any, method: string, path: string) {
  const roles = auth?.roles ?? [];
  const has = (...r) => r.some((x) => roles.includes(x));
  if (path.startsWith('/api/v1/auth/')) return 200;
  if (!auth) return 401;
  if (/^\/api\/v1\/(accounts|users|roles|sessions)(\/|$)/.test(path)) return has('ADMIN') ? 200 : 403;
  if (method === 'GET' && path === '/api/v1/teachers/me/overview') return has('TEACHER') ? 200 : 403;
  if (/^\/api\/v1\/teachers(\/|$)/.test(path)) return has('ADMIN') ? 200 : 403;
  // V50: a estrutura académica (anos, períodos, disciplinas, cursos, turmas, currículo) só o ADMIN altera.
  if (method !== 'GET' && /^\/api\/v1\/(school-years|terms|subjects|courses|classes)(\/|$)/.test(path)) return has('ADMIN') ? 200 : 403;
  if (/^\/api\/v1\/subjects\/[^/]+\/offerings$/.test(path)) return has('ADMIN') ? 200 : 403;
  if (/^\/api\/v1\/donations(\/|$)/.test(path)) return has('ADMIN') ? 200 : 403;
  // kixi#506: as pautas lêem-se por papel (o âmbito de cada uma decide-o o handler); o aluno só pelo seu `/me`.
  if (/^\/api\/v1\/term-sheets(\/|$)/.test(path)) return has('ADMIN', 'TEACHER', 'COORDINATOR') ? 200 : 403;
  // kixi#523: o plano do trimestre é do professor, do coordenador e do administrador; o handler decide o que cada um faz.
  if (/^\/api\/v1\/term-plans(\/|$)/.test(path)) return has('ADMIN', 'TEACHER', 'COORDINATOR') ? 200 : 403;
  if (/^\/api\/v1\/coordination(\/|$)/.test(path)) return has('ADMIN', 'COORDINATOR') && method === 'GET' ? 200 : 403;
  if (path === '/api/v1/me/term-sheets') return has('STUDENT') ? 200 : 403;
  // Como no backend: a lista de atribuições é de ADMIN; o `/me` é o único
  // ponto que um professor pode ler.
  if (/^\/api\/(v1\/)?teaching-assignments\/me$/.test(path)) return has('ADMIN', 'TEACHER') ? 200 : 403;
  // creative-mode/kixi#206: o professor escreve o estilo do tutor das suas; o handler confirma que são dele.
  if (method === 'PUT' && /^\/api\/v1\/teaching-assignments\/\d+\/tutor-style$/.test(path)) return has('ADMIN', 'TEACHER') ? 200 : 403;
  if (/^\/api\/(v1\/)?teaching-assignments(\/|$)/.test(path)) return has('ADMIN') ? 200 : 403;
  if (/^\/api\/v1\/institutions(\/|$)/.test(path)) {
    const readable = method === 'GET' && (path === '/api/v1/institutions' || path === '/api/v1/institutions/mine' || /^\/api\/v1\/institutions\/\d+(\/subjects)?$/.test(path));
    return readable || has('ADMIN') ? 200 : 403;
  }
  // kixi#255: emitir, listar por turma e revogar códigos de matrícula é ADMIN-only.
  if (/^\/api\/v1\/enrollment-codes(\/|$)/.test(path)) return has('ADMIN') ? 200 : 403;
  if (method === 'GET') {
    if (/^\/api\/v1\/statements\/(review|from-ocr|trash|stats)$/.test(path) || /\/trash$/.test(path)) return has('ADMIN', 'TEACHER') ? 200 : 403;
    return 200;
  }
  // Escrever num enunciado é do ADMIN ou de um professor affiliated à instituição
  // dona dele (`StatementWriteAccessService`). Só o papel não chega: um professor
  // de outra escola não mexe no enunciado de uma que não é sua. O mesmo vale para
  // as perguntas e opções, que são filhas do enunciado.
  if (/^\/api\/v1\/questions\/\d+\/correct-option$/.test(path) || /^\/api\/v1\/statements\/\d+\/questions(\/|$)/.test(path)) {
    if (!has('ADMIN', 'TEACHER')) return 403;
    if (has('ADMIN')) return 200;
    // `Number(undefined)` é NaN e não undefined, por isso o ?? não serviria aqui.
    const fromPath = path.match(/^\/api\/v1\/statements\/(\d+)/);
    const questionId = Number(path.match(/questions\/(\d+)/)?.[1]);
    const statementId = fromPath
      ? Number(fromPath[1])
      : db.statements.find((s: any) => s.questions.some((q: any) => q.id === questionId))?.id;
    const teacher = db.teachers.find((t: any) => t.accountId === Number(auth.sub) && !t.deletedAt);
    const statement = db.statements.find((s: any) => s.id === statementId);
    if (!statement) return 403;
    const affiliated = db.institutionTeachers.some((l: any) => l.institutionId === statement.institutionId && l.teacherId === teacher?.id);
    return affiliated ? 200 : 403;
  }
  if (/^\/api\/(v1\/)?simulations/.test(path) && method !== 'DELETE' && !/restore/.test(path)) return has('ADMIN', 'TEACHER', 'STUDENT') ? 200 : 403;
  // Como no backend: o SecurityConfig só pede sessão, e cada acção decide no ExamRoomController.
  if (/^\/api\/(v1\/)?exam-rooms(\/|$)/.test(path)) return 200;
  return has('ADMIN', 'TEACHER') ? 200 : 403;
}

/** Reescreve `is_correct` em todas as opções da pergunta, como
 *  `QuestionOptionRepository.setCorrectOption`, para a resposta se manter singular.
 *  Ignora linhas removidas: um `isCorrect` numa opção apagada não é resposta nenhuma. */
export function markCorrect(q, optionId) {
  for (const o of q.options ?? []) if (!o.deletedAt) o.isCorrect = o.id === Number(optionId);
  return { ...(q.options ?? []).find((o) => o.id === Number(optionId)) };
}

export const pick = (row, keys) => Object.fromEntries(keys.map((k) => [k, row[k] ?? null]));
export const nonNull = (row) => Object.fromEntries(Object.entries(row).filter(([, v]) => v != null));

/** `StatementController.StatementSummary`: sem instruções, sem questões e sem courseId. */
export function mapStatement(s) {
  return pick(s, ['id', 'title', 'examType', 'durationMinutes', 'variant', 'totalMaxScore', 'visible', 'needsReview', 'source', 'ocrConfidence', 'schoolYearId', 'termId', 'subjectId', 'classId', 'institutionId']);
}
/** `StatementOcrResponse` (o `/full`): sem institutionId nem courseId, e as questões sem
 *  modelAnswer. A chave de respostas e a revisão só vão para o staff. NON_NULL. */
export function mapStatementFull(s, staff) {
  const live = (xs) => (xs ?? []).filter((x) => !x.deletedAt).sort((a, b) => (a.orderIndex ?? a.number ?? 0) - (b.orderIndex ?? b.number ?? 0));
  return nonNull({
    ...pick(s, ['id', 'title', 'examType', 'durationMinutes', 'variant', 'instructions', 'totalMaxScore', 'visible', 'source', 'ocrRequestId', 'schoolYearId', 'termId', 'subjectId', 'classId']),
    needsReview: staff ? s.needsReview : null,
    ocrConfidence: staff ? s.ocrConfidence : null,
    questions: live(s.questions).map((q) => nonNull({
      ...pick(q, ['id', 'number', 'text', 'questionType', 'maxScore', 'orderIndex', 'ocrConfidence', 'pageIndex', 'parentId', 'label']),
      needsReview: staff ? q.needsReview : null,
      options: live(q.options).map((o) => nonNull({ ...pick(o, ['id', 'optionLabel', 'optionText', 'orderIndex']), isCorrect: staff ? o.isCorrect : null, ocrConfidence: staff ? o.ocrConfidence : null })),
    })),
  });
}
/** `QuestionResponse` (GET /statements/{id}/questions): com modelAnswer para o staff, sem opções. */
export function mapQuestion(q, statementId, staff) {
  return nonNull({
    ...pick(q, ['id', 'number', 'text', 'questionType', 'maxScore', 'orderIndex', 'pageIndex', 'parentId', 'label', 'createdAt', 'updatedAt', 'deletedAt']),
    statementId,
    modelAnswer: staff ? q.modelAnswer : null,
    needsReview: staff ? q.needsReview : null,
  });
}
export function mapSimulation(s) {
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


// Pedidos de verificação do mock (#322): um por rever, um aprovado e um recusado.
export function verificationStore() {
  G.__kixiVerification ??= [
    [1, 'ITEL', 'PENDING', null], [2, 'IMIL', 'PENDING', null], [3, 'ITEL', 'APPROVED', null], [2, 'IMIL', 'REJECTED', 'Documento ilegível'],
  ].map(([institutionId, code, status, reviewNote], i) => ({
    id: i + 1, institutionId, officialName: `Instituto ${code} (nome oficial)`, registrationNumber: `NIF-${5000 + i}`,
    contactEmail: `direcao@${String(code).toLowerCase()}.ao`, documentUrl: 'https://example.com/alvara.pdf', notes: null,
    status, reviewNote, reviewedAt: status === 'PENDING' ? null : '2026-10-10T09:00:00', createdAt: `2026-10-0${i + 1}T08:00:00`,
  }));
  return G.__kixiVerification;
}

/**
 * Denúncias e auditoria (#323).
 *
 * Store separada, à maneira da verificação: o mock do gestor não partilha memória com
 * o do aluno (são processos diferentes), por isso uma denúncia feita no app do aluno
 * não aparece aqui. O que este mock garante é que a fila e a auditoria têm conteúdo e
 * que as decisões batem certo com o contrato.
 */
export function moderationStore() {
  G.__kixiModeration ??= {
    next: 4,
    reports: [
      { id: 1, target: 'ACCOUNT', targetId: 1, targetName: 'Administrador Kixi', reporterAccountId: 3, reporterName: 'Abner Ede', reason: 'IMPERSONATION', note: 'Usa o selo da escola num perfil que nao e da escola.', status: 'OPEN', createdAt: '2026-10-14T09:12:00', decidedAt: null, decidedBy: null, decisionNote: null },
      { id: 2, target: 'ACCOUNT', targetId: 4, targetName: 'Carlos Mendes', reporterAccountId: 1, reporterName: 'Administrador Kixi', reason: 'OFFENSIVE_PHOTO', note: '', status: 'OPEN', createdAt: '2026-10-14T08:40:00', decidedAt: null, decidedBy: null, decisionNote: null },
      { id: 3, target: 'INSTITUTION', targetId: 2, targetName: 'Instituto Médio Industrial de Luanda', reporterAccountId: 3, reporterName: 'Abner Ede', reason: 'FAKE_SCHOOL', note: 'O nome existe mas o endereço nao corresponde a nenhuma escola registrada.', status: 'OPEN', createdAt: '2026-10-13T19:03:00', decidedAt: null, decidedBy: null, decisionNote: null },
      { id: 4, target: 'INSTITUTION', targetId: 1, targetName: 'Instituto de Telecomunicações', reporterAccountId: 4, reporterName: 'Carlos Mendes', reason: 'OTHER', note: 'Looks legit, mas o selo caducou.', status: 'IGNORED', createdAt: '2026-10-12T11:20:00', decidedAt: '2026-10-12T15:02:00', decidedBy: 'Administrador Kixi', decisionNote: 'Escola verificada e com selo valido.' },
    ],
    audit: [
      { id: 1, at: '2026-10-12T15:02:00', actor: 'Administrador Kixi', action: 'IGNORED', target: 'INSTITUTION', targetId: 1, targetName: 'Instituto de Telecomunicações', reportId: 4, note: 'Escola verificada e com selo valido.' },
    ],
  };
  return G.__kixiModeration;
}

// Doações do mock: três, para a lista, o filtro e a revisão terem com que trabalhar.
export const PIXEL = ['iVBORw0KGgoAAA', 'ANSUhEUgAAAAE', 'AAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQ', 'AA', 'AABJRU5ErkJg', 'g=='].join('');
export function donationStore() {
  G.__kixiDonations ??= [
    ['KD-7F3K-92QX', 'pending', 'ITEL', 'Matemática', 'Exame'],
    ['KD-ABCD-2345', 'pending', 'Escola 5 de Abril', 'OGI', 'Prova'],
    ['KD-HJ4K-MN56', 'approved', 'Liceu do Kilamba', 'Física', 'Teste'],
  ].map(([reference, status, institutionName, subjectName, examType], i) => ({
    id: i + 1, reference, status, donorName: i === 0 ? 'Ana Silva' : null, donorEmail: i === 0 ? 'ana@example.com' : null,
    institutionName, subjectName, classGrade: '12ª Classe', schoolYear: '2024/2025', examType, notes: i === 0 ? 'Prova do 1º trimestre' : null,
    consentAt: '2026-10-15T10:00:00', consentVersion: '2026-10-v1', reviewNote: null, reviewedAt: null, statementId: null, createdAt: `2026-10-1${i + 1}T09:30:00`,
    files: [{ id: i * 10 + 1, originalName: `prova-${i + 1}.png`, contentType: 'image/png', sizeBytes: 70, base64: PIXEL }],
  }));
  return G.__kixiDonations;
}



// ── extra seed + analytics ──────────────────────────────────────────────────
export function seedExtras() {
  add('sessions', { accountId: db.accounts[0].id, token: crypto.randomBytes(24).toString('hex'), ipAddress: '41.63.10.22', expiresAt: new Date(Date.now() + 86400000).toISOString().slice(0, 19), lastUsed: now() });
  add('sessions', { accountId: db.accounts[2].id, token: crypto.randomBytes(24).toString('hex'), ipAddress: '41.63.11.7', expiresAt: new Date(Date.now() - 86400000).toISOString().slice(0, 19), lastUsed: null });
  const student = db.accounts.find((a: any) => a.username === '12345');
  const sy = db['school-years'][0];
  add('simulations', { accountId: student.id, statementId: 1, schoolYearId: sy.id, startedAt: now(), finishedAt: now(), timeSpentSeconds: 3120, finalScore: 15.5, status: 'COMPLETED' });
  // Ids pela mesma sequência global que o resto do mock. Antes eram `si * 10 + i + 1`
  // e `i + 1`, que reiniciavam por enunciado: um enunciado criado depois vinha com
  // perguntas de id 1 e colidia com as da semente, e `PUT /questions/{id}/correct-option`
  // — que só recebe o id da pergunta — resolvia a do enunciado errado.
  const opts = (labels: string[], correct: number) => labels.map((t, i) => ({ id: nextId('options'), questionId: null, optionLabel: 'ABCD'[i], optionText: t, isCorrect: i === correct, orderIndex: i, deletedAt: null }));
  const qs = [
    ['Qual é o endereço de broadcast da rede 192.168.10.0/26?', ['192.168.10.31', '192.168.10.63', '192.168.10.64', '192.168.10.127'], 1],
    ['Quantos hosts úteis tem uma sub-rede /27?', ['30', '32', '62', '14'], 0],
    ['Que camada do modelo OSI trata do roteamento?', ['Enlace', 'Rede', 'Transporte', 'Sessão'], 1],
    ['Qual protocolo resolve nomes em endereços IP?', ['DHCP', 'ARP', 'DNS', 'ICMP'], 2],
    ['Para que serve uma VLAN?', ['Aumentar a banda', 'Segmentar a rede logicamente', 'Cifrar tráfego', 'Balancear carga'], 1],
    ['Qual é a máscara de um /24?', ['255.255.0.0', '255.255.255.0', '255.255.255.128', '255.0.0.0'], 1],
  ];
  db.statements.forEach((st: any) => {
    st.institutionId = st.institutionId ?? 1;
    st.questions = qs.map(([text, o, c]: any, i: number) => ({ id: nextId('questions'), statementId: st.id, number: i + 1, orderIndex: i, text, questionType: 'MULTIPLE_CHOICE', maxScore: 20 / qs.length, needsReview: st.needsReview && i === 2, options: opts(o, c) }));
    st.questions.forEach((q: any) => q.options.forEach((opt: any) => { opt.questionId = q.id; }));
  });
  for (const [qid, opt] of [[1, 2], [2, 1], [3, 2]]) {
    const q = db.statements[0].questions.find((x: any, i: number) => i + 1 === qid);
    const o = q.options.find((x: any) => x.optionLabel === 'ABCD'[opt - 1]);
    add('simulation-answers', { simulationId: 1, questionId: q.id, selectedOptionId: o.id, answerText: null, answeredAt: now(), isCorrect: o.isCorrect, scoreObtained: o.isCorrect ? q.maxScore : 0 });
  }
  // Matriculados na turma da Helena: com o aluno da semente são cinco, o que a
  // #24 pede para correr uma sala de prova de ponta a ponta.
  for (const [username, first, last] of [['helder', 'Helder', 'Gomes'], ['mariana', 'Mariana', 'Costa'], ['paulo', 'Paulo', 'Neto'], ['sara', 'Sara', 'Pinto']]) {
    const acc = seedAccount(username, `${username}@kixi.ao`, 'STUDENT', first, last);
    add('enrollments', { accountId: acc.id, classId: db.classes[0].id, schoolYearId: sy.id, status: 'ACTIVE' });
  }

  // Uma sala a decorrer, com um aluno e eventos de integridade (#192), para o
  // professor ter o que ver na consola sem correr a stack toda. No backend, quem
  // escreve estes eventos é o aluno, pelo `POST /simulations/{id}/integrity-events`;
  // o mock do gestor é outro processo e outra base, por isso semeia-os aqui (a
  // limitação do kixi#323, registada na nota do endpoint).
  const helena = db.accounts.find((a: any) => a.username === 'professor');
  const wall = (mins: number) => new Date(Date.now() + 3_600_000 + mins * 60_000).toISOString().slice(0, 19);
  const room = add('exam-rooms', {
    statementId: 1,
    classId: db.classes[0].id,
    teacherAccountId: helena.id,
    startsAt: wall(-30),
    endsAt: wall(60),
    durationMinutes: 90,
    status: 'RUNNING',
  });
  const roomSim = add('simulations', {
    accountId: student.id,
    statementId: 1,
    examRoomId: room.id,
    schoolYearId: sy.id,
    startedAt: wall(-29),
    finishedAt: null,
    timeSpentSeconds: 0,
    finalScore: null,
    status: 'IN_PROGRESS',
  });
  add('exam-room-participants', { examRoomId: room.id, accountId: student.id, simulationId: roomSim.id, joinedAt: wall(-29) });
  // Os restantes convidados ainda não entraram: mostram a coluna vazia de eventos.
  for (const acc of db.accounts.filter((a: any) => ['helder', 'mariana', 'paulo', 'sara'].includes(a.username))) {
    add('exam-room-participants', { examRoomId: room.id, accountId: acc.id, simulationId: null, joinedAt: null });
  }
  for (const [kind, mins, questionId] of [
    ['TAB_HIDDEN', -25, null],
    ['TAB_VISIBLE', -24, null],
    ['WINDOW_BLUR', -18, null],
    ['WINDOW_FOCUS', -17, null],
    ['PASTE_BLOCKED', -12, db.statements[0].questions[2]?.id ?? null],
    ['TUTOR_BLOCKED', -6, null],
  ] as [string, number, number | null][]) {
    add('integrity-events', { simulationId: roomSim.id, kind, questionId, at: wall(mins) });
  }
}

export const INSTITUTIONS = [
  { id: 1, code: 'ITEL', name: 'Instituto de Telecomunicações', courses: 4, classes: 14, students: 412, finishedSimulations: 1280, averageScorePercent: 74.2, averageTimeSeconds: 3120 },
  { id: 2, code: 'ISPTEC', name: 'Instituto Superior Politécnico de Tecnologias e Ciências', courses: 6, classes: 18, students: 530, finishedSimulations: 960, averageScorePercent: 69.8, averageTimeSeconds: 3480 },
  { id: 3, code: 'IMIL', name: 'Instituto Médio Industrial de Luanda', courses: 3, classes: 9, students: 238, finishedSimulations: 410, averageScorePercent: 66.1, averageTimeSeconds: 2940 },
];

export function analytics(path: string, url: URL, auth: any) {
  const active = db.statements.filter((s: any) => !s.deletedAt);
  // Como o BE-15: o professor só vê as turmas das suas atribuições.
  const admin = (auth?.roles ?? []).includes('ADMIN');
  const teacher = db.teachers.find((t: any) => t.accountId === Number(auth?.sub) && !t.deletedAt);
  const myClasses = new Set(db['teaching-assignments'].filter((a: any) => !a.deletedAt && a.teacherId === teacher?.id).map((a: any) => a.classId));
  const inScope = (classId: number) => admin || myClasses.has(classId);
  const classMatch = path.match(/^\/api\/v1\/analytics\/classes\/(\d+)\/(students|weekly|questions)$/);
  if (classMatch) {
    const cid = Number(classMatch[1]);
    if (!db.classes.find((c: any) => c.id === cid && !c.deletedAt)) return problem(404, 'Class not found');
    if (!inScope(cid)) return problem(403, 'Class is outside your teaching assignments');
    if (classMatch[2] === 'students') {
      const ids = db.enrollments.filter((e: any) => e.classId === cid && !e.deletedAt && e.status === 'ACTIVE').map((e: any) => e.accountId);
      const rows = ids.map((id: number, i: number) => {
        const u = db.users.find((x: any) => x.accountId === id);
        const avg = [42.5, null, 68.0, 81.3, 55.0][i % 5];
        const finished = avg == null ? 0 : 2 + (i % 3);
        return { accountId: id, name: u ? `${u.firstName} ${u.lastName}` : `Conta ${id}`, finishedSimulations: finished, averageScorePercent: avg, lastFinishedAt: avg == null ? null : new Date(Date.now() - i * 86400000).toISOString(), status: avg == null ? 'NO_ACTIVITY' : avg < 50 ? 'AT_RISK' : 'OK' };
      });
      return json(200, rows.sort((a: any, b: any) => (a.averageScorePercent ?? -1) - (b.averageScorePercent ?? -1)));
    }
    if (classMatch[2] === 'weekly') {
      const weeks = Math.min(Math.max(Number(url.searchParams.get('weeks') ?? 8), 1), 52);
      const monday = new Date();
      monday.setUTCHours(0, 0, 0, 0);
      monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
      return json(200, Array.from({ length: weeks }, (_, i) => {
        const d = new Date(monday.getTime() - (weeks - 1 - i) * 7 * 86400000);
        const finished = ((i * 7) % 5) + (i > 1 ? 3 : 0);
        return { weekStart: d.toISOString().slice(0, 10), finished, averageScorePercent: finished ? Math.round((55 + i * 2.5) * 10) / 10 : null };
      }));
    }
    // O par turma+disciplina, como o scope do backend: SO na turma da Helena é de outro professor.
    const mine = db['teaching-assignments'].filter((a: any) => !a.deletedAt && a.teacherId === teacher?.id);
    const ownsPair = (s: any) => admin || mine.some((a: any) => a.classId === s.classId && a.subjectId === s.subjectId);
    const qs = active.filter((s: any) => s.classId === cid && ownsPair(s)).flatMap((s: any) => s.questions.filter((q: any) => q.options?.length).map((q: any) => ({ s, q })));
    return json(200, qs.map(({ s, q }: any, i: number) => {
      const attempts = 12;
      const correct = (i * 5 + 3) % attempts;
      return { id: q.id, number: q.number, text: q.text, questionType: q.questionType, maxScore: q.maxScore, statementId: s.id, statementTitle: s.title, attempts, correct, correctPercent: Math.round((correct / attempts) * 1000) / 10 };
    }).sort((a: any, b: any) => a.correctPercent - b.correctPercent).slice(0, Number(url.searchParams.get('limit') ?? 10)));
  }
  // Filtros como no backend: só estreitam. Os dados aqui são de demonstração.
  const classFilter = Number(url.searchParams.get('classId') ?? 0);
  const instFilter = Number(url.searchParams.get('institutionId') ?? 0);
  const instName = INSTITUTIONS.find((i) => i.id === instFilter)?.name;
  if (path === '/api/v1/analytics/overview') {
    return json(200, {
      scope: admin ? 'ADMIN' : 'TEACHER', institutions: INSTITUTIONS.length, classes: INSTITUTIONS.reduce((n, i) => n + i.classes, 0),
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
  if (path === '/api/v1/analytics/institutions') return json(200, INSTITUTIONS.filter((i) => !instFilter || i.id === instFilter));
  if (path === '/api/v1/analytics/classes') {
    return json(200, [
      { id: 1, code: '12B', grade: 12, course: 'Informática e Sistemas Multimédia', institution: 'Instituto de Telecomunicações', students: 31, teachers: 4, statements: 6, finishedSimulations: 128, averageScorePercent: 76.4, averageTimeSeconds: 3010 },
      { id: 2, code: '12A', grade: 12, course: 'Informática e Sistemas Multimédia', institution: 'Instituto de Telecomunicações', students: 29, teachers: 4, statements: 5, finishedSimulations: 104, averageScorePercent: 72.9, averageTimeSeconds: 3180 },
      { id: 3, code: '11C', grade: 11, course: 'Redes e Telecomunicações', institution: 'Instituto Superior Politécnico de Tecnologias e Ciências', students: 34, teachers: 3, statements: 4, finishedSimulations: 88, averageScorePercent: 64.2, averageTimeSeconds: 3600 },
      { id: 4, code: '13A', grade: 13, course: 'Eletrónica', institution: 'Instituto Médio Industrial de Luanda', students: 26, teachers: 3, statements: 3, finishedSimulations: 52, averageScorePercent: 58.7, averageTimeSeconds: 2880 },
    ].filter((c) => inScope(c.id) && (!classFilter || c.id === classFilter) && (!instFilter || c.institution === instName)));
  }
  const m = path.match(/^\/api\/v1\/analytics\/statements\/(\d+)\/questions$/);
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
    return json(200, active.filter((s: any) => !classFilter || s.classId === classFilter).slice(0, limit).map((s: any, i: number) => ({
      id: s.id, title: s.title, examType: s.examType, classCode: '12B', subject: db.subjects.find((x: any) => x.id === s.subjectId)?.short_name ?? null,
      published: s.visible, needsReview: s.needsReview, answerKeyComplete: !s.needsReview, questions: s.questions.length,
      finishedSimulations: 60 - i * 11, uniqueStudents: 44 - i * 8, averageScorePercent: [78.2, 71.5, 64.9, null][i] ?? 70, passRatePercent: [88.6, 79.1, 66.7, null][i] ?? 70, averageTimeSeconds: 3100 + i * 240,
    })));
  }
  return null;
}

/** Auxiliares que dependem de quem pede: o papel, a escola ativa e a regra de escrita do enunciado. */
export function requestHelpers(auth: any) {
  const isAdmin = (auth?.roles ?? []).includes('ADMIN');
  const activeInst = (id) => db.institutions.find((i) => i.id === Number(id) && !i.deletedAt);
  const writeWorld = () => ({
    institutions: db.institutions, teachers: db.teachers, institutionTeachers: db.institutionTeachers,
    institutionSubjects: db.institutionSubjects, assignments: db['teaching-assignments'],
  });
  /** `StatementWriteAccessService.requireCanWrite`, para as rotas de questão, opção e gabarito. */
  const denyWrite = (st) => {
    const p = st ? canWriteProblem(writeWorld(), Number(auth.sub), isAdmin, st) : null;
    return p ? problem(p.status, p.message) : null;
  };
  return { isAdmin, activeInst, writeWorld, denyWrite };
}
