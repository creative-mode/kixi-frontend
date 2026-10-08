import 'server-only';
import { resolveSchoolId } from './school';

import crypto from 'node:crypto';
import type {
  Course,
  Enrollment,
  Institution,
  Me,
  SchoolYear,
} from '@/lib/types';
/** In-process stand-in for the Spring Boot backend: the aluno app needs no server
 *  while we design. Same contracts as the real API — DTO shapes (including the
 *  snake_case annotations), soft delete, RFC 9457 errors, HS256 JWT — and the same
 *  security rules, so the screens can be built against it without a database.
 *  The secret matches the manager's, so the same cookie works on both apps.
 *  Set KIXI_MOCK=false to talk to the real API instead. */
export const MOCK = process.env.KIXI_MOCK !== 'false';

/** Inject a backend failure, so the client's resilience can be exercised for real:
 *  `KIXI_MOCK_FAULT=500` makes every route answer 500 and `=timeout` makes them fail the
 *  way a dead network does. Without this the `unknown` state of `lib/me.ts` — the one that
 *  keeps a student in the feed when the server is down instead of logging them out — is
 *  unreachable while designing, and a regression there would pass every test. */
export const FAULT = (process.env.KIXI_MOCK_FAULT ?? '').toLowerCase();

const SECRET = process.env.JWT_SECRET || 'default-secret-change-in-production-min-256-bits';
const SEED_PASSWORD = 'Kixi1234!';
const TOKEN_TTL = 86400;

type Account = {
  id: number;
  username: string;
  email: string;
  passwordHash: string;
  roles: string[];
  active: boolean;
  firstName: string;
  lastName: string;
  photo: string | null;
};
/** How a class is stored, as opposed to how ClassResponse exposes it: the rows keep
 *  the foreign keys and the response resolves them into nested objects. */
type ClassRow = {
  id: number;
  code: string;
  grade: number | null;
  courseId: number;
  schoolYearId: number;
  /** Always the course's school, the same invariant the backend enforces with a
   *  composite foreign key. Stored here so the class list can be filtered by school
   *  without a join, which is what the real /classes?institutionId= does. */
  institutionId: number;
};

type Store = {
  accounts: Account[];
  nextAccount: number;
  institutions: Institution[];
  courses: Course[];
  schoolYears: SchoolYear[];
  classes: ClassRow[];
  enrollments: Enrollment[];
  nextEnrollment: number;
  /** The institution each student profile belongs to; an administrator sets this. */
  institutionByAccount: Record<number, number>;
};

const G = globalThis as unknown as { __kixiStudentMock?: Store };

const hash = (pw: string) => crypto.createHash('sha256').update(`kixi:${pw}`).digest('hex');
const b64 = (v: object) => Buffer.from(JSON.stringify(v)).toString('base64url');

function sign(payload: object): string {
  const head = b64({ alg: 'HS256', typ: 'JWT' });
  const body = b64(payload);
  const sig = crypto.createHmac('sha256', SECRET).update(`${head}.${body}`).digest('base64url');
  return `${head}.${body}.${sig}`;
}

/** Mirrors the backend's JwtService: signature and expiry are checked here, unlike
 *  the unverified read in lib/session.ts that only drives routing. */
function accountIdOf(token: string | null): number | null {
  if (!token) return null;
  const [head, body, sig] = token.split('.');
  if (!head || !body || !sig) return null;
  const expected = crypto.createHmac('sha256', SECRET).update(`${head}.${body}`).digest('base64url');
  if (sig !== expected) return null;
  try {
    const claims = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (typeof claims.exp === 'number' && claims.exp * 1000 < Date.now()) return null;
    return Number(claims.sub) || null;
  } catch {
    return null;
  }
}

function seed(): Store {
  const schoolYears: SchoolYear[] = [
    { id: 1, startYear: 2025, endYear: 2026 },
    { id: 2, startYear: 2024, endYear: 2025 },
  ];
  const institutions: Institution[] = [
    { id: 1, code: 'ITEL', name: 'Instituto de Telecomunicações', short_name: 'ITEL', logo: null },
    { id: 2, code: 'ISPTEC', name: 'Instituto Superior Politécnico', short_name: 'ISPTEC', logo: null },
  ];
  // A course belongs to one school, and a class always sits in the school of its course.
  const courses: Course[] = [
    {
      id: 1,
      code: 'TISM',
      name: 'Técnico de Informática e Sistemas Multimédia',
      description: 'Curso técnico do ITEL',
      institutionId: 1,
    },
    {
      id: 2,
      code: 'TLP',
      name: 'Técnico de Laboratório Philips',
      description: null,
      institutionId: 2,
    },
    {
      id: 3,
      code: 'TLP-ITEL',
      name: 'Técnico de Laboratório de Informática',
      description: 'Curso técnico do ITEL',
      institutionId: 1,
    },
  ];
  const classes = [
    { id: 1, code: '12B', grade: 12, courseId: 1, schoolYearId: 1, institutionId: 1 },
    { id: 2, code: '12A', grade: 12, courseId: 1, schoolYearId: 1, institutionId: 1 },
    { id: 3, code: '11B', grade: 11, courseId: 1, schoolYearId: 1, institutionId: 1 },
    { id: 4, code: '12B', grade: 12, courseId: 1, schoolYearId: 2, institutionId: 1 },
    { id: 5, code: '11A', grade: 11, courseId: 3, schoolYearId: 1, institutionId: 1 },
    { id: 6, code: '10A', grade: 10, courseId: 2, schoolYearId: 1, institutionId: 2 },
  ];

  const account = (
    id: number,
    username: string,
    email: string,
    role: string,
    firstName: string,
    lastName: string,
  ): Account => ({
    id,
    username,
    email,
    passwordHash: hash(SEED_PASSWORD),
    roles: [role],
    active: true,
    firstName,
    lastName,
    photo: null,
  });

  const accounts = [
    account(1, 'admin', 'admin@kixi.ao', 'ADMIN', 'Ana', 'Costa'),
    account(2, 'professor', 'professor@kixi.ao', 'TEACHER', 'Bruno', 'Mendes'),
    account(3, '12345', 'aluno@kixi.ao', 'STUDENT', 'Abner', 'Ede'),
  ];

  return {
    accounts,
    nextAccount: 4,
    institutions,
    courses,
    schoolYears,
    classes,
    enrollments: [
      { id: 1, accountId: 3, classId: 1, schoolYearId: 1, status: 'ACTIVE' },
    ],
    nextEnrollment: 2,
    // The seeded student is also explicitly affiliated with ITEL, as an administrator
    // would have done, so /me can be seen answering with the linked school. An account
    // created through /auth/register has no link and gets the school of its class.
    institutionByAccount: { 3: 1 },
  };
}

function store(): Store {
  G.__kixiStudentMock ??= seed();
  return G.__kixiStudentMock;
}

/** RFC 9457 problem details, as produced by ApiException in the backend. */
function problem(status: number, detail: string): Response {
  return Response.json({ type: null, title: null, status, detail, properties: null }, { status });
}

function validationError(fields: Record<string, string>): Response {
  return Response.json(
    {
      type: 'https://api.kixi.ao/errors/validation-error',
      title: 'Validation Error',
      status: 400,
      detail: 'Validation failed for one or more fields',
      properties: { ...fields, requestId: 'req-mock' },
    },
    { status: 400 },
  );
}

/** The security layer writes 401/403 without a body; the client has to cope. Only 401
 *  is reachable here — every academic GET is merely `authenticated()`, and the 403s
 *  that do happen come from service checks and carry a problem body. */
function unauthorized(): Response {
  return new Response(null, { status: 401 });
}

const json = <T>(data: T, status = 200) => Response.json(data, { status });

function loginResponse(account: Account) {
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + TOKEN_TTL;
  return {
    accessToken: sign({ sub: String(account.id), roles: account.roles, iat, exp }),
    tokenType: 'Bearer',
    expiresAt: new Date(exp * 1000).toISOString(),
    accountId: account.id,
    roles: account.roles,
  };
}

const yearLabel = (year: SchoolYear) => `${year.startYear}/${year.endYear}`;

/** Resolves the class list the way ClassService.toResponse does: the nested course and
 *  school year are always objects, empty when the referenced row is gone. */
function classResponse(db: Store, row: ClassRow) {
  const course = db.courses.find((c) => c.id === row.courseId);
  const schoolYear = db.schoolYears.find((y) => y.id === row.schoolYearId);
  return {
    id: row.id,
    code: row.code,
    grade: row.grade,
    course: course ?? {},
    schoolYear: schoolYear ?? {},
    institutionId: row?.institutionId ?? course?.institutionId ?? null,
    createdAt: null,
    updatedAt: null,
    deletedAt: null,
  };
}

function meResponse(db: Store, account: Account): Me {
  const latest = db.enrollments
    .filter((e) => e.accountId === account.id && e.status === 'ACTIVE')
    .sort((a, b) => b.id - a.id)[0];

  const row = latest ? db.classes.find((c) => c.id === latest.classId) : undefined;
  const course = row ? db.courses.find((c) => c.id === row.courseId) : undefined;
  const schoolYear = latest ? db.schoolYears.find((y) => y.id === latest.schoolYearId) : undefined;

  const linked = db.institutions.find((i) => i.id === db.institutionByAccount[account.id]);
  const fromClass =
    row?.institutionId ?? course?.institutionId ? db.institutions.find((i) => i.id === (row?.institutionId ?? course?.institutionId)) : undefined;
  const institution = resolveSchoolId(fromClass, linked);

  return {
    accountId: account.id,
    username: account.username,
    email: account.email,
    first_name: account.firstName || null,
    last_name: account.lastName || null,
    photo: account.photo,
    roles: account.roles,
    school: institution
      ? { id: institution.id, code: institution.code, name: institution.name }
      : null,
    course: course ? { id: course.id, code: course.code, name: course.name } : null,
    currentClass:
      row && schoolYear
        ? {
            id: row.id,
            code: row.code,
            grade: row.grade,
            school_year_id: schoolYear.id,
            school_year: yearLabel(schoolYear),
          }
        : null,
  };
}

export async function mockHandle(
  method: string,
  path: string,
  token: string | null,
  bodyText: string,
): Promise<Response> {
  if (FAULT === 'timeout') throw new TypeError('fetch failed');
  if (FAULT === '500') {
    return problem(500, 'Injected failure');
  }
  const db = store();
  // `path` may carry a query string, exactly as the real request would: the mock has
  // to filter the same way the backend does, or the screens get exercised against a
  // contract that does not exist.
  const [pathname, rawQuery = ''] = path.split('?');
  const search = new URLSearchParams(rawQuery);
  const filter = (key: string) => {
    const value = search.get(key);
    return value === null || value === '' ? undefined : Number(value);
  };
  const body = bodyText ? (JSON.parse(bodyText) as Record<string, unknown>) : {};
  const text = (key: string) => String(body[key] ?? '').trim();
  const accountId = accountIdOf(token);

  // ── public: the two auth routes ─────────────────────────────────────────────
  if (pathname === '/auth/login' && method === 'POST') {
    const key = text('usernameOrEmail');
    if (!key || !body.password) return problem(400, 'usernameOrEmail, password is required');
    const found = db.accounts.find(
      (a) => a.username === key || a.email === key.toLowerCase(),
    );
    if (!found || found.passwordHash !== hash(String(body.password))) {
      return problem(401, 'Invalid username or password');
    }
    if (!found.active) return problem(401, 'Account is inactive');
    return json(loginResponse(found));
  }

  if (pathname === '/auth/register' && method === 'POST') {
    const missing = ['username', 'email', 'password', 'firstName', 'lastName'].filter(
      (key) => !text(key),
    );
    if (missing.length) return problem(400, `${missing.join(', ')} is required`);
    if (String(body.password).length < 8) return problem(400, 'Password must be at least 8 characters');
    const username = text('username');
    const email = text('email').toLowerCase();
    if (db.accounts.some((a) => a.username === username || a.email === email)) {
      return problem(409, 'Username or email already exists');
    }
    const account: Account = {
      id: db.nextAccount++,
      username,
      email,
      passwordHash: hash(String(body.password)),
      roles: ['STUDENT'],
      active: true,
      firstName: text('firstName'),
      lastName: text('lastName'),
      photo: null,
    };
    db.accounts.push(account);
    return json(loginResponse(account), 201);
  }

  // ── everything else needs a live session ───────────────────────────────────
  if (accountId === null) return unauthorized();
  // O backend filtra `active` e `deletedAt` e devolve 404, nao 401: sao estados
  // diferentes para o cliente, que manda para o login num e deixa passar no outro.
  const account = db.accounts.find((a) => a.id === accountId && a.active);
  if (!account) return problem(404, 'Account not found');

  const staff = account.roles.some((role) => role === 'ADMIN' || role === 'TEACHER');

  if (pathname === '/me' && method === 'GET') return json(meResponse(db, account));

  if (pathname === '/me' && method === 'PUT') {
    const first = text('first_name');
    const last = text('last_name');
    const photo = text('photo');

    if (first.length > 100 || last.length > 100) {
      return problem(400, 'First name must not exceed 100 characters');
    }
    if (photo.length > 500) return problem(400, 'Photo must not exceed 500 characters');
    if (!account.firstName || !account.lastName) {
      if (!first || !last) {
        return problem(400, 'First and last name are required to create the profile');
      }
    }

    if (first) account.firstName = first;
    if (last) account.lastName = last;
    // MeService assigns whatever it receives, so an empty string clears the photo
    // rather than nulling it; the client treats blank as "no picture".
    if (body.photo !== undefined) account.photo = photo;
    return json(meResponse(db, account));
  }

  if (pathname === '/institutions' && method === 'GET') return json(db.institutions);

  if (pathname === '/courses' && method === 'GET') {
    const institutionId = filter('institutionId');
    return json(
      institutionId === undefined
        ? db.courses
        : db.courses.filter((course) => course.institutionId === institutionId),
    );
  }

  if (pathname === '/school-years' && method === 'GET') {
    // Sem ordem: o backend devolve o que a base de dados der, e `lib/school-year.ts`
    // ordena do lado do cliente. Ordenar aqui esconderia isso.
    return json(db.schoolYears);
  }

  if (pathname === '/classes' && method === 'GET') {
    const institutionId = filter('institutionId');
    const courseId = filter('courseId');
    const rows = db.classes.filter((row) => {
      if (institutionId !== undefined && row.institutionId !== institutionId) return false;
      if (courseId !== undefined && row.courseId !== courseId) return false;
      return true;
    });
    return json(rows.map((row) => classResponse(db, row)));
  }

  if (pathname === '/enrollments' && method === 'GET') {
    const requested = search.get('accountId');
    const visible = requested ? db.enrollments.filter((e) => e.accountId === Number(requested)) : db.enrollments;
    return json(staff ? visible : visible.filter((e) => e.accountId === account.id));
  }

  if (pathname === '/enrollments' && method === 'POST') {
    const target = body.accountId === undefined || body.accountId === null
      ? account.id
      : Number(body.accountId);
    if (target !== account.id && !staff) {
      return problem(403, 'Only ADMIN or TEACHER can enroll another account');
    }
    const missing: Record<string, string> = {};
    if (!Number.isInteger(Number(body.classId))) missing.classId = 'Class is required';
    if (!Number.isInteger(Number(body.schoolYearId))) missing.schoolYearId = 'School year is required';
    if (Object.keys(missing).length) return validationError(missing);

    const targetAccount = db.accounts.find((a) => a.id === target);
    if (!targetAccount || !targetAccount.active) return problem(404, 'Account not found');

    const classId = Number(body.classId);
    const schoolYearId = Number(body.schoolYearId);
    const row = db.classes.find((c) => c.id === classId);
    if (!row) return problem(404, 'Class not found');
    if (row.schoolYearId !== schoolYearId) {
      return problem(400, 'Class does not belong to the given school year');
    }
    if (!db.schoolYears.some((y) => y.id === schoolYearId)) {
      return problem(404, 'School year not found');
    }
    const active = db.enrollments.find(
      (e) => e.accountId === target && e.schoolYearId === schoolYearId && e.status === 'ACTIVE',
    );
    if (active) {
      return problem(409, 'Account already has an active enrollment for this school year');
    }

    const enrollment: Enrollment = {
      id: db.nextEnrollment++,
      accountId: target,
      classId,
      schoolYearId,
      status: 'ACTIVE',
    };
    db.enrollments.push(enrollment);
    return json(enrollment, 201);
  }

  return problem(404, `No route for ${method} ${pathname}`);
}

/** Kept for the auth server actions, which post without a session. */
export const mockPost = (path: string, payload: Record<string, unknown>) =>
  mockHandle('POST', path, null, JSON.stringify(payload));
