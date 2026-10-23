/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import 'server-only';
// In-process stand-in for the Spring Boot backend: the manager runs with no network and no database.
// Same contracts as scripts/mock-api.mjs (paths, DTOs, soft delete, HS256 JWT). State lives in memory per server process.
/* eslint-disable @typescript-eslint/no-explicit-any */
import crypto from 'node:crypto';
import { getJwtSecretValue } from '../dev-secret';
import { approvalProblem } from './gate';
import { examRooms, liveStream, luandaClock } from './exam-rooms';
import { assignmentsFrom, teacherCanWrite } from '../crud/teacher-scope';
import { canWriteProblem, updateProblem } from './statement-write';
import { buildQuestions } from './manual-questions';
import { OGI_EXTRACTION } from './ogi-extraction';
import { addToCurriculum, buildStructure, removeFromCurriculum, subjectOfferings, subjectsOfClass, teacherOverview, validateAssignment, type AcademicWorld } from './academic';

const SEED_PASSWORD = 'Kixi1234!';


const b64 = (b) => Buffer.from(b).toString('base64url');
function sign(payload) {
  const h = b64(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const p = b64(JSON.stringify(payload));
  const s = crypto.createHmac('sha256', getJwtSecretValue()).update(`${h}.${p}`).digest('base64url');
  return `${h}.${p}.${s}`;
}
function verify(token) {
  const [h, p, s] = token.split('.');
  if (!h || !p || !s) return null;
  const expect = crypto.createHmac('sha256', getJwtSecretValue()).update(`${h}.${p}`).digest('base64url');
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
  'integrity-events': [],
  institutions: [], teachers: [], institutionSubjects: [], institutionTeachers: [], institutionStudents: [],
  enrollments: [], 'teaching-assignments': [], courseSubjects: [],
};
const db: any = G.__kixiMock.db;
function add(table, data) {
  const t = now();
  const row = { id: nextId(table), ...data, createdAt: t, updatedAt: t, deletedAt: null };
  db[table].push(row);
  return row;
}

const roleId = (n) => db.roles.find((r) => r.name === n).id;

// Salas de Prova: regras em ./exam-rooms.ts, com testes.
const rooms = examRooms({
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
function json(status: number, body?: unknown) {
  if (status === 204 || body === undefined) return new Response(null, { status });
  return Response.json(body, { status });
}
const problem = (status: number, detail: string) => json(status, { type: null, title: null, status, detail, properties: null });
const strip = (row: any) => {
  if (!row) return row;
  const rest = { ...row };
  delete rest.passwordHash;
  return rest;
};
const missing = (body: any, fields: string[]) => fields.filter((f: string) => body[f] === undefined || body[f] === null || body[f] === '');

const academicWorld = (): AcademicWorld => ({
  institutions: db.institutions, courses: db.courses, classes: db.classes, subjects: db.subjects, teachers: db.teachers,
  courseSubjects: db.courseSubjects, institutionSubjects: db.institutionSubjects, institutionTeachers: db.institutionTeachers,
  assignments: db['teaching-assignments'], enrollments: db.enrollments, schoolYears: db['school-years'],
});

// resource definitions: table, id field (id | code), required request fields, response mapper, optional update
const RES = {
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

function authorize(auth: any, method: string, path: string) {
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
function markCorrect(q, optionId) {
  for (const o of q.options ?? []) if (!o.deletedAt) o.isCorrect = o.id === Number(optionId);
  return { ...(q.options ?? []).find((o) => o.id === Number(optionId)) };
}

const pick = (row, keys) => Object.fromEntries(keys.map((k) => [k, row[k] ?? null]));
const nonNull = (row) => Object.fromEntries(Object.entries(row).filter(([, v]) => v != null));

/** `StatementController.StatementSummary`: sem instruções, sem questões e sem courseId. */
function mapStatement(s) {
  return pick(s, ['id', 'title', 'examType', 'durationMinutes', 'variant', 'totalMaxScore', 'visible', 'needsReview', 'source', 'ocrConfidence', 'schoolYearId', 'termId', 'subjectId', 'classId', 'institutionId']);
}
/** `StatementOcrResponse` (o `/full`): sem institutionId nem courseId, e as questões sem
 *  modelAnswer. A chave de respostas e a revisão só vão para o staff. NON_NULL. */
function mapStatementFull(s, staff) {
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
function mapQuestion(q, statementId, staff) {
  return nonNull({
    ...pick(q, ['id', 'number', 'text', 'questionType', 'maxScore', 'orderIndex', 'pageIndex', 'parentId', 'label', 'createdAt', 'updatedAt', 'deletedAt']),
    statementId,
    modelAnswer: staff ? q.modelAnswer : null,
    needsReview: staff ? q.needsReview : null,
  });
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


// Pedidos de verificação do mock (#322): um por rever, um aprovado e um recusado.
function verificationStore() {
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
function moderationStore() {
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
const PIXEL = ['iVBORw0KGgoAAA', 'ANSUhEUgAAAAE', 'AAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQ', 'AA', 'AABJRU5ErkJg', 'g=='].join('');
function donationStore() {
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
      const rest = { ...u };
      delete rest.accountId;
      return json(200, { ...rest, account: a ? { id: a.id, username: a.username, email: a.email } : null });
    }


    // ── institutions: affiliations and teacher access ──
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

    // ── manual statements (exam builder) ──
    if (path === '/api/v1/statements/manual' && method === 'POST') {
      const b = readBody();
      const miss = missing(b, ['institutionId', 'subjectId', 'title', 'examType']);
      if (miss.length) return problem(400, `${miss.join(', ')} is required`);
      if (!Array.isArray(b.questions) || !b.questions.length) return problem(400, 'A statement needs at least one question');
      const inst = activeInst(b.institutionId);
      if (!inst) return problem(404, 'Institution not found');
      if (!isAdmin) {
        const t = db.teachers.find((x) => x.accountId === Number(auth.sub) && !x.deletedAt);
        if (!t) return problem(403, 'Only teachers can build statements');
        if (!db.institutionTeachers.some((l) => l.institutionId === inst.id && l.teacherId === t.id)) return problem(403, 'Teacher is not affiliated with this institution');
      }
      if (!db.institutionSubjects.some((l) => l.institutionId === inst.id && l.subjectId === Number(b.subjectId))) return problem(422, 'Subject is not taught by this institution');
      // Ids vêm da sequência global, como no backend. A versão anterior reiniciava a
      // contagem em cada enunciado, o que fazia dois enunciados diferentes terem
      // perguntas com o mesmo id — e `PUT /questions/{id}/correct-option`, que só leva
      // o id da pergunta, passava a resolver a pergunta do enunciado errado.
      // O contrato novo: `type` por questão e, num `group`, as alíneas em `items`.
      // A construção e as regras vivem em ./manual-questions.ts, onde se testam.
      if (b.durationMinutes != null && !(Number(b.durationMinutes) > 0)) return problem(400, 'The duration must be greater than zero');
      const built = buildQuestions(b.questions, () => nextId('questions'), () => nextId('options'));
      if (!built.ok) return problem(built.status, built.message);
      const questions = built.questions;
      const row = add('statements', {
        title: b.title, examType: b.examType, durationMinutes: b.durationMinutes ?? null, variant: b.variant ?? null, instructions: b.instructions ?? null,
        totalMaxScore: built.total, visible: !!b.visible, needsReview: false, source: 'manual',
        ocrConfidence: null, ocrRequestId: null, schoolYearId: b.schoolYearId ?? null, termId: b.termId ?? null, subjectId: Number(b.subjectId),
        classId: b.classId ?? null, courseId: b.courseId ?? null, institutionId: inst.id, questions,
      });
      for (const q of questions) {
        q.statementId = row.id;
        for (const o of q.options) o.questionId = q.id;
      }
      return json(201, mapStatement(row));
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
      if (sub === '/full' && method === 'GET') return s.deletedAt || (!isStaff && !s.visible) ? problem(404, 'Statement not found') : json(200, mapStatementFull(s, isStaff));
      if (!sub && method === 'DELETE') { s.deletedAt = now(); return json(204); }
      if (sub === '/restore' && method === 'POST') { s.deletedAt = null; return json(204); }
      if (sub === '/purge' && method === 'DELETE') { db.statements = db.statements.filter((x) => x.id !== id); return json(204); }
      if (sub === '/approve' && method === 'POST') {
        // O gate do BE-08, nas mesmas duas regras de `StatementService`: uma pergunta
        // com opções e sem resposta marcada, e um total que não bate com a soma.
        const blocked = approvalProblem(s);
        if (blocked) return problem(422, blocked);
        s.needsReview = false;
        return json(200, mapStatement(s));
      }
      if (sub === '/visibility' && method === 'PATCH') { s.visible = url.searchParams.get('visible') === 'true'; return json(200, mapStatement(s)); }
      // PUT do enunciado = StatementRequest: só metadados. As questões não vão aqui (o
      // backend descarta-as em silêncio) e têm as rotas de questão/opção abaixo.
      if (!sub && method === 'PUT') {
        if (s.deletedAt) return problem(404, 'Statement not found');
        const b = readBody();
        const numOrNull = (v) => (v == null || v === '' ? null : Number(v));
        if (b.institutionId == null) return problem(400, 'The institution is required');
        if (b.subjectId == null) return problem(400, 'The subject is required');
        const title = String(b.title ?? '').trim();
        if (title.length < 3 || title.length > 500) return problem(400, 'The title must be between 3 and 500 characters');
        if (!String(b.examType ?? '').trim()) return problem(400, 'The exam type is required');
        if (b.durationMinutes != null && !(Number(b.durationMinutes) > 0)) return problem(400, 'The duration must be greater than zero');
        if (b.totalMaxScore != null && !(Number(b.totalMaxScore) >= 0)) return problem(400, 'The total score cannot be negative');
        if (!db.subjects.find((x) => x.id === Number(b.subjectId) && !x.deletedAt)) return problem(404, 'Subject not found');
        if (b.classId != null && !db.classes.find((x) => x.id === Number(b.classId) && !x.deletedAt)) return problem(404, 'Class not found');
        // As regras do StatementService.update: turma obrigatória ao professor, quem pode
        // mexer neste enunciado, e se pode apontá-lo para esta escola, disciplina e turma.
        const blocked = updateProblem(writeWorld(), Number(auth.sub), isAdmin, s, {
          institutionId: Number(b.institutionId), subjectId: Number(b.subjectId), classId: numOrNull(b.classId),
        });
        if (blocked) return problem(blocked.status, blocked.message);
        Object.assign(s, {
          institutionId: Number(b.institutionId), subjectId: Number(b.subjectId), title, examType: String(b.examType).trim(),
          durationMinutes: numOrNull(b.durationMinutes), variant: b.variant || null, instructions: b.instructions || null,
          // Como o apply() do servidor: grava o que vier, e null apaga o total.
          totalMaxScore: numOrNull(b.totalMaxScore),
          schoolYearId: numOrNull(b.schoolYearId), termId: numOrNull(b.termId), classId: numOrNull(b.classId), courseId: numOrNull(b.courseId),
          updatedAt: now(),
        });
        return json(200, mapStatement(s));
      }
    }

    // ── questions (BE-08) ──
    if ((m = path.match(/^\/api\/v1\/statements\/(\d+)\/questions(?:\/(trash|reorder|\d+(?:\/(restore|purge))?))?$/))) {
      const s = db.statements.find((x) => x.id === Number(m[1]));
      if (!s) return problem(404, 'Statement not found');
      if (method !== 'GET') { const denied = denyWrite(s); if (denied) return denied; }
      const sub = m[2];
      const live = () => s.questions.filter((q) => !q.deletedAt).sort((a, b) => a.number - b.number);
      const nextNumber = () => Math.max(0, ...s.questions.map((q) => q.number)) + 1;

      if (!sub && method === 'GET') return json(200, live().map((q) => mapQuestion(q, s.id, isStaff)));
      if (sub === 'trash' && method === 'GET') return json(200, s.questions.filter((q) => q.deletedAt).map((q) => ({ ...q })));

      if (sub === 'reorder' && method === 'PUT') {
        // `QuestionReorderRequest` tem de nomear todas as perguntas activas, uma vez
        // cada: mais curto deixa perguntas numa ordem que ninguém escolheu, mais longo
        // nomeia uma que não lá está. Ambos são recusados em vez de adivinhados.
        const b = readBody();
        const ids = b.questionIds;
        if (!Array.isArray(ids) || ids.length === 0) return problem(400, 'The list of question ids is required');
        const current = live();
        if (ids.length !== current.length || new Set(ids).size !== ids.length || ids.some((id) => !current.some((q) => q.id === Number(id)))) {
          return problem(422, 'The reorder must name every active question of the statement exactly once');
        }
        ids.forEach((id, i) => { const q = current.find((x) => x.id === Number(id)); q.orderIndex = i; });
        current.forEach((q, i) => { q.number = i + 1; });
        return json(200, live().map((q) => ({ ...q })));
      }

      if (sub && /^\d+$/.test(sub) && method === 'GET') {
        const q = s.questions.find((x) => x.id === Number(sub));
        if (!q || q.deletedAt) return problem(404, 'Question not found');
        return json(200, { ...q });
      }

      if (!sub && method === 'POST') {
        const b = readBody();
        if (!b.text || !String(b.text).trim()) return problem(400, 'The question text is required');
        // `QuestionRequest.maxScore` é @NotNull, e a razão está escrita no DTO: uma
        // edição que o omita guardaria NULL, encolheria a soma em silêncio e deixaria
        // o enunciado impossível de aprovar — devolvendo 200 à edição que o fez.
        if (b.maxScore == null) return problem(400, 'The question score is required');
        const q = { id: nextId('questions'), statementId: s.id, number: nextNumber(), text: String(b.text).trim(), questionType: b.questionType ?? 'open', maxScore: Number(b.maxScore), orderIndex: live().length, pageIndex: b.pageIndex ?? null, modelAnswer: b.modelAnswer ?? null, needsReview: false, options: [] };
        s.questions.push(q);
        return json(201, { ...q });
      }

      if (sub && /^\d+$/.test(sub)) {
        const q = s.questions.find((x) => x.id === Number(sub));
        if (!q || q.deletedAt) return problem(404, 'Question not found');
        if (method === 'DELETE') { q.deletedAt = now(); return json(204); }
        if (method === 'PUT') {
          const b = readBody();
          if (b.text != null && !String(b.text).trim()) return problem(400, 'The question text is required');
          // Omitir a cotação também viola o @NotNull: um PUT que a omita guardaria
          // NULL, encolheria a soma em silêncio e deixaria o enunciado impossível de
          // aprovar para sempre — com a edição que o fez a devolver 200.
          if (!Object.keys(b).includes('maxScore')) return problem(400, 'The question score is required');
          if (b.maxScore === null) return problem(400, 'The question score is required');
          if (b.text != null) q.text = String(b.text).trim();
          if (b.maxScore != null) q.maxScore = Number(b.maxScore);
          if (b.questionType != null) q.questionType = b.questionType;
          if (b.pageIndex != null) q.pageIndex = Number(b.pageIndex);
          // Como o setModelAnswer(blankToNull(...)) do servidor: vazio ou null apaga.
          if ('modelAnswer' in b) q.modelAnswer = b.modelAnswer && String(b.modelAnswer).trim() ? String(b.modelAnswer) : null;
          return json(200, { ...q });
        }
      }
    }

    // ── question options (BE-08) ──
    if ((m = path.match(/^\/api\/v1\/statements\/(\d+)\/questions\/(\d+)\/options(?:\/(trash|reorder|\d+(?:\/(restore|purge))?))?$/))) {
      const s = db.statements.find((x) => x.id === Number(m[1]));
      const q = s?.questions.find((x) => x.id === Number(m[2]) && !x.deletedAt);
      if (!s || !q) return problem(404, 'Question not found');
      if (method !== 'GET') { const denied = denyWrite(s); if (denied) return denied; }
      const sub = m[3];
      q.options ??= [];
      const liveOpts = () => q.options.filter((o) => !o.deletedAt).sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));
      const nextOrder = () => liveOpts().length;

      if (!sub && method === 'GET') return json(200, liveOpts().map((o) => ({ ...o })));
      if (sub === 'trash' && method === 'GET') return json(200, q.options.filter((o) => o.deletedAt).map((o) => ({ ...o })));

      if (sub === 'reorder' && method === 'PUT') {
        const b = readBody();
        const ids = b.optionIds;
        if (!Array.isArray(ids) || ids.length === 0) return problem(400, 'The list of option ids is required');
        const current = liveOpts();
        if (ids.length !== current.length || new Set(ids).size !== ids.length || ids.some((id) => !current.some((o) => o.id === Number(id)))) {
          return problem(422, 'The reorder must name every active option of the question exactly once');
        }
        ids.forEach((id, i) => { const o = current.find((x) => x.id === Number(id)); o.orderIndex = i; });
        return json(200, liveOpts().map((o) => ({ ...o })));
      }

      if (sub && /^\d+$/.test(sub) && method === 'GET') {
        const o = q.options.find((x) => x.id === Number(sub));
        if (!o || o.deletedAt) return problem(404, 'Option not found');
        return json(200, { ...o });
      }

      if (!sub && method === 'POST') {
        const b = readBody();
        if (!b.optionLabel || !String(b.optionLabel).trim()) return problem(400, 'The option label is required');
        if (!b.optionText || !String(b.optionText).trim()) return problem(400, 'The option text is required');
        // `optionLabel` é identidade única por pergunta e o índice não conhece as linhas
        // removidas: uma etiqueta fica tomada para sempre. `isCorrect` passa pelo mesmo
        // rewrite na criação e na edição, para a resposta se manter singular.
        const label = String(b.optionLabel).trim();
        if (q.options.some((o) => o.optionLabel === label && !o.deletedAt)) return problem(409, `The option label ${label} is already used in this question`);
        const o = { id: nextId('options'), questionId: q.id, optionLabel: label, optionText: String(b.optionText).trim(), isCorrect: false, orderIndex: nextOrder() };
        q.options.push(o);
        return json(201, b.isCorrect ? markCorrect(q, o.id) : { ...o });
      }

      if (sub && /^\d+$/.test(sub)) {
        const o = q.options.find((x) => x.id === Number(sub));
        if (!o || o.deletedAt) return problem(404, 'Option not found');
        if (method === 'PUT') {
          const b = readBody();
          if (!b.optionText || !String(b.optionText).trim()) return problem(400, 'The option text is required');
          o.optionText = String(b.optionText).trim();
          // `isCorrect` é honrado na edição também. Já só era honrado na criação e
          // descartado em silêncio no PUT: o corpo pedia a opção correcta, recebia
          // um 200, e nada mudava.
          if (b.isCorrect) markCorrect(q, o.id);
          return json(200, { ...o });
        }
        if (method === 'DELETE') { o.deletedAt = now(); return json(204); }
      }
    }

    // ── correct option (BE-08) ──
    if ((m = path.match(/^\/api\/v1\/questions\/(\d+)\/correct-option$/)) && method === 'PUT') {
      const b = readBody();
      if (!b.optionId) return problem(400, 'The option id is required');
      const q = db.statements.flatMap((s) => s.questions).find((x) => x.id === Number(m[1]) && !x.deletedAt);
      if (!q) return problem(404, 'Question not found');
      const denied = denyWrite(db.statements.find((x) => x.questions.includes(q)));
      if (denied) return denied;
      const o = (q.options ?? []).find((x) => x.id === Number(b.optionId) && !x.deletedAt);
      // A opção tem de pertencer à pergunta do path: o query que a marca reescreve
      // is_correct em todas as opções dessa pergunta, e um id estrangeiro deixaria a
      // pergunta sem resposta nenhuma em vez de falhar.
      if (!o) return problem(404, 'Option not found');
      return json(200, markCorrect(q, o.id));
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

    // ── OCR: extração estruturada, sem persistir (alimenta o construtor de provas) ──
    // O mock não corre o motor: responde sempre com a prova de OGI lida como o contrato manda.
    if (path === '/api/v1/ocr/extract/exam' && method === 'POST') {
      const b = readBody();
      const files = [b.files ?? b.file].flat().filter(Boolean);
      if (!files.length) return problem(400, 'At least one file is required');
      return json(200, { ...OGI_EXTRACTION, request_id: `req-${Date.now()}`, processing_time_ms: 1200 });
    }

    // ── OCR import: creates a statement waiting for review ──
    if ((path === '/api/v1/statements/ocr/extract' || path === '/api/v1/statements/ocr/extract/single') && method === 'POST') {
      const b = readBody();
      const files = [b.files ?? b.file].flat().filter(Boolean);
      if (!files.length) return problem(400, 'At least one file is required');
      const title = String(files[0].name ?? 'Prova importada').replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim() || 'Prova importada';
      const sy = db['school-years'][0];
      const s = add('statements', {
        title, examType: 'P1', durationMinutes: 60, variant: null, instructions: null, totalMaxScore: 6, visible: false, needsReview: true,
        source: 'OCR', ocrConfidence: 0.82, ocrRequestId: `req-${Date.now()}`, schoolYearId: sy?.id ?? null, termId: null, subjectId: null, classId: null,
        questions: [1, 2, 3].map((n) => ({ id: 1000 + nextId('questions'), number: n, questionType: 'MULTIPLE_CHOICE', text: `Questão ${n} extraída de ${files.length} ficheiro(s). Reveja o texto.`, maxScore: 2, needsReview: true, options: ['A', 'B', 'C', 'D'].map((l, i) => ({ id: 1000 + nextId('options'), optionLabel: l, optionText: `Opção ${l}`, isCorrect: i === 0 })) })),
      });
      return json(201, s);
    }

    // ── exam rooms (BE-16/BE-17) ──
    if ((m = path.match(/^\/api\/(?:v1\/)?exam-rooms(?:\/(mine|owned|\d+))?(?:\/(participants|open|start|close|join|live|grades|integrity))?$/))) {
      const me = Number(auth.sub);
      const roles = auth.roles ?? [];
      const admin = roles.includes('ADMIN');
      const staff = admin || roles.includes('TEACHER');
      const out = (o) => (o.ok ? json(o.status, o.body) : problem(o.problem.status, o.problem.detail));
      const [, target, action] = m;
      const id = Number(target);
      if (!target && !action && method === 'POST') {
        return staff ? out(rooms.create(readBody(), me, admin)) : problem(403, 'Only teachers or ADMIN can create exam rooms');
      }
      if (target === 'owned' && method === 'GET') return json(200, staff ? rooms.owned(me) : []);
      if (target === 'mine' && method === 'GET') return json(200, rooms.mine(me));
      if (Number.isFinite(id) && method === 'POST') {
        if (action === 'join') return out(rooms.join(id, me));
        if (!staff) return problem(403, 'Only teachers or ADMIN can manage exam rooms');
        if (action === 'participants') return out(rooms.addParticipant(id, readBody(), me, admin));
        const next = { open: 'OPEN', start: 'RUNNING', close: 'CLOSED' }[action];
        if (next) return out(rooms.transition(id, me, admin, next));
      }
      if (Number.isFinite(id) && method === 'GET' && staff) {
        if (action === 'grades') return out(rooms.grades(id, me, admin));
        if (action === 'integrity') return out(rooms.integrity(id, me, admin));
        if (action === 'live') {
          const first = rooms.live(id, me, admin);
          return first.ok ? liveStream(() => rooms.live(id, me, admin)) : out(first);
        }
      }
      if (Number.isFinite(id) && method === 'GET' && !staff) return problem(403, 'Only teachers or ADMIN can view exam room progress');
      return problem(405, 'Method not allowed');
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

    if (path.startsWith('/api/v1/analytics') && method === 'GET') { const a = analytics(path, url, auth); if (a) return a; }

    // ── estrutura académica (V50): currículo, estrutura da escola, visão do professor, onde se leciona ──
    if ((m = path.match(/^\/api\/v1\/courses\/(\d+)\/subjects(?:\/(\d+))?$/))) {
      const cid = Number(m[1]);
      const course = db.courses.find((c) => c.id === cid && !c.deletedAt);
      if (!course) return problem(404, 'Course not found');
      const w = academicWorld();
      if (method === 'GET' && !m[2]) {
        return json(200, w.courseSubjects.filter((l) => l.courseId === cid && !l.deletedAt).map((l) => {
          const sb = db.subjects.find((x) => x.id === l.subjectId);
          return { id: l.id, courseId: cid, subjectId: sb.id, code: sb.code, name: sb.name, shortName: sb.short_name ?? null, grade: l.grade };
        }));
      }
      if (method === 'POST' && !m[2]) {
        const b = readBody();
        if (!b.subjectId) return problem(400, 'The subject is required');
        const r = addToCurriculum(w, cid, Number(b.subjectId), b.grade == null || b.grade === '' ? null : Number(b.grade), () => nextId('courseSubjects'));
        if (r.problem) return problem(r.problem.status, r.problem.message);
        const sb = db.subjects.find((x) => x.id === r.link.subjectId);
        return json(201, { id: r.link.id, courseId: cid, subjectId: sb.id, code: sb.code, name: sb.name, shortName: sb.short_name ?? null, grade: r.link.grade });
      }
      if (method === 'DELETE' && m[2]) {
        const p = removeFromCurriculum(w, cid, Number(m[2]));
        return p ? problem(p.status, p.message) : json(204);
      }
    }
    if ((m = path.match(/^\/api\/v1\/classes\/(\d+)\/subjects$/)) && method === 'GET') {
      const k = db.classes.find((c) => c.id === Number(m[1]) && !c.deletedAt);
      if (!k) return problem(404, 'Class not found');
      const w = academicWorld();
      return json(200, subjectsOfClass(w, k).map((sb) => ({
        subjectId: sb.id, code: sb.code, name: sb.name,
        teachers: db['teaching-assignments'].filter((a) => !a.deletedAt && a.classId === k.id && a.subjectId === sb.id).map((a) => {
          const t = db.teachers.find((x) => x.id === a.teacherId);
          return { id: t.id, firstName: t.firstName, lastName: t.lastName, assignmentId: a.id };
        }),
      })));
    }
    if ((m = path.match(/^\/api\/v1\/institutions\/(\d+)\/structure$/)) && method === 'GET') {
      const yr = url.searchParams.get('schoolYearId');
      const st = buildStructure(academicWorld(), Number(m[1]), yr ? Number(yr) : null);
      return st ? json(200, st) : problem(404, 'Institution not found');
    }
    if (path === '/api/v1/teachers/me/overview' && method === 'GET') {
      const t = db.teachers.find((x) => x.accountId === Number(auth.sub) && !x.deletedAt);
      return t ? json(200, teacherOverview(academicWorld(), t.id)) : problem(404, 'Teacher not found');
    }
    if ((m = path.match(/^\/api\/v1\/teachers\/(\d+)\/overview$/)) && method === 'GET') {
      const o = teacherOverview(academicWorld(), Number(m[1]));
      return o ? json(200, o) : problem(404, 'Teacher not found');
    }
    if ((m = path.match(/^\/api\/v1\/subjects\/([^/]+)\/offerings$/)) && method === 'GET') {
      const o = subjectOfferings(academicWorld(), decodeURIComponent(m[1]));
      return o ? json(200, o) : problem(404, 'Subject not found');
    }
    // só escolas com turmas no ano (onboarding do aluno)
    if (path === '/api/v1/institutions' && method === 'GET' && url.searchParams.has('onlyWithClassesInYear')) {
      const y = Number(url.searchParams.get('onlyWithClassesInYear'));
      const ids = new Set(db.classes.filter((c) => !c.deletedAt && c.schoolYear?.id === y).map((c) => c.institutionId));
      return json(200, db.institutions.filter((i) => !i.deletedAt && ids.has(i.id)));
    }

    // ── turmas por escola/curso (ClassController: ?institutionId=&courseId=) ──
    if (path === '/api/v1/classes' && method === 'GET' && (url.searchParams.has('institutionId') || url.searchParams.has('courseId'))) {
      const inst = url.searchParams.get('institutionId');
      const course = url.searchParams.get('courseId');
      return json(200, db.classes.filter((c) => !c.deletedAt && (!inst || c.institutionId === Number(inst)) && (!course || c.course?.id === Number(course))));
    }
    // ── as atribuições do professor com sessão (TeachingAssignmentController.listMine) ──
    if (path === '/api/v1/teaching-assignments/me' && method === 'GET') {
      const t = db.teachers.find((x) => x.accountId === Number(auth.sub) && !x.deletedAt);
      return json(200, t ? db['teaching-assignments'].filter((a) => !a.deletedAt && a.teacherId === t.id) : []);
    }

    // ── o estilo do tutor de uma atribuição (TeachingAssignmentController.updateTutorStyle, kixi#206) ──
    m = path.match(/^\/api\/v1\/teaching-assignments\/(\d+)\/tutor-style$/);
    if (m && method === 'PUT') {
      const a = db['teaching-assignments'].find((x) => x.id === Number(m[1]) && !x.deletedAt);
      if (!a) return problem(404, 'Teaching assignment not found');
      const admin = (auth?.roles ?? []).includes('ADMIN');
      const t = db.teachers.find((x) => x.id === a.teacherId && !x.deletedAt);
      if (!admin && (!t || t.accountId !== Number(auth.sub))) return problem(403, 'Only the assigned teacher or ADMIN can change this tutor style');
      const raw = readBody().tutorStyle;
      const style = typeof raw === 'string' && raw.trim() ? raw.trim() : null;
      if (style && style.length > 100) return problem(400, 'The tutor style must not exceed 100 characters');
      a.tutorStyle = style;
      return json(200, a);
    }

    // ── teaching-assignments/me: como no backend, só as atribuições da conta.
    if (path === '/api/v1/teaching-assignments/me' && method === 'GET') {
      const t = db.teachers.find((x) => x.accountId === Number(auth.sub) && !x.deletedAt);
      if (!t) return json(200, []);
      return json(200, db['teaching-assignments'].filter((a) => !a.deletedAt && a.teacherId === t.id));
    }

    // ── generic CRUD (/api/v1/<resource>) ──
    m = path.match(/^\/api\/v1\/([a-z-]+)(?:\/(trash|active|[^/]+?))?(?:\/(restore|purge|login))?$/);
    const def = m && RES[m[1]];
    if (def) {
      const keyField = def.key ?? 'id';
      const rows = db[def.table];
      const seg = m[2];
      const act = m[3];
      const out = (r) => (def.table === 'accounts' ? strip(r) : def.table === 'teachers' ? { ...r, hasAccess: !!r.accountId } : r);
      if (!seg && method === 'GET') return json(200, rows.filter((r) => !r.deletedAt).map(out));
      if (seg === 'trash' && method === 'GET') return json(200, rows.filter((r) => r.deletedAt).map(out));
      if (seg === 'active' && def.table === 'accounts' && method === 'GET') return json(200, rows.filter((r) => !r.deletedAt && r.active === (url.searchParams.get('active') !== 'false')).map(out));
      if (!seg && method === 'POST') {
        if (def.readOnly) return problem(405, 'Method not allowed');
        const b = readBody();
        const miss = missing(b, def.req);
        if (miss.length) return problem(400, `${miss.join(', ')} is required`);
        // validação (400) e conflito de unicidade (409) têm estados próprios.
        const verr = def.validate?.(b);
        if (verr) return problem(400, verr);
        const rerr = def.rule?.(b);
        if (rerr) return problem(rerr.status, rerr.message);
        const uerr = def.unique?.(b, null);
        if (uerr) return problem(409, uerr);
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
        const verr2 = def.validate?.(b);
        if (verr2) return problem(400, verr2);
        const rerr2 = def.rule?.(b);
        if (rerr2) return problem(rerr2.status, rerr2.message);
        const guard2 = def.updateGuard?.(b, row);
        if (guard2) return problem(409, guard2);
        const uerr2 = def.unique?.(b, row.id);
        if (uerr2) return problem(409, uerr2);
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

const INSTITUTIONS = [
  { id: 1, code: 'ITEL', name: 'Instituto de Telecomunicações', courses: 4, classes: 14, students: 412, finishedSimulations: 1280, averageScorePercent: 74.2, averageTimeSeconds: 3120 },
  { id: 2, code: 'ISPTEC', name: 'Instituto Superior Politécnico de Tecnologias e Ciências', courses: 6, classes: 18, students: 530, finishedSimulations: 960, averageScorePercent: 69.8, averageTimeSeconds: 3480 },
  { id: 3, code: 'IMIL', name: 'Instituto Médio Industrial de Luanda', courses: 3, classes: 9, students: 238, finishedSimulations: 410, averageScorePercent: 66.1, averageTimeSeconds: 2940 },
];

function analytics(path: string, url: URL, auth: any) {
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
