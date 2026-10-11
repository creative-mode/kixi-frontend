import 'server-only';
import { catalogPage } from './catalog-page';
import { findVisible, summaryOf } from './statement-detail';
import { resolveSchoolId } from './school';
import {
  deadlineFor,
  expired,
  finalScore,
  gradeAnswer,
  toLocalDateTime,
  type MockAnswer,
  type MockQuestion,
} from './simulation';

import crypto from 'node:crypto';
import { parseServerTime } from '../exam-rules';
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
  /** Read-only from the student's side; the backend has already folded it into the
   *  simulation's `deadline`, so the mock mirrors that rather than recomputing it. */
  accessibilityExtraTime: boolean;
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

/**
 * One statement row, for the catalog and for `GET /statements/{id}`.
 *
 * Havia uma tabela paralela para o detalhe, com os mesmos enunciados e outros
 * valores — duracoes diferentes, e o enunciado 3 visivel aqui e oculto la. Era o
 * pior de dois mundos: os dois ecrãs discordavam sobre a mesma prova sem que nada
 * dissesse. Uma linha so, com os campos que ambos precisam.
 *
 * `termId`, `needsReview` e `ocrConfidence` sao reais, como o StatementSummary os
 * devolve; `needsReview` e `ocrConfidence` so importam para quem nao e aluno, e o
 * detalhe esconde-os.
 */
type CatalogRow = {
  id: number;
  title: string;
  examType: string;
  subjectId: number | null;
  schoolYearId: number | null;
  termId: number | null;
  institutionId: number | null;
  classId: number | null;
  durationMinutes: number | null;
  totalMaxScore: number | null;
  variant: string | null;
  source: 'MANUAL' | 'OCR';
  needsReview: boolean;
  ocrConfidence: number | null;
  visible: boolean;
};

type SimulationRow = {
  id: number;
  accountId: number;
  statementId: number;
  status: 'IN_PROGRESS' | 'FINISHED' | 'CANCELLED';
  finalScore: number | null;
  startedAt: string | null;
  finishedAt: string | null;
  timeSpentSeconds: number | null;
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
  subjects: { id: number; code: string; name: string }[];
  statements: CatalogRow[];
  questions: MockQuestion[];
  simulations: SimulationRow[];
  answers: MockAnswer[];
  nextSimulation: number;
  nextAnswer: number;
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
    accessibilityExtraTime = false,
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
    accessibilityExtraTime,
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
    subjects: [
      { id: 1, code: 'RED', name: 'Redes de Computadores' },
      { id: 2, code: 'SO', name: 'Sistemas Operativos' },
      { id: 3, code: 'MD', name: 'Matemática Discreta' },
    ],
    // One finished, one in progress, one untouched: the three card states.
    // A prova 1 é a que a sala abre; as de SO e Matemática dão enunciados com
    // outra mistura: uma aberta a meio, que só o professor pode corrigir.
    statements: [
      { id: 1, title: 'Redes de Computadores', examType: 'Teste', subjectId: 1, schoolYearId: 1, termId: 1, institutionId: 1, classId: 1, durationMinutes: 60, totalMaxScore: 20, variant: null, source: 'MANUAL', needsReview: false, ocrConfidence: null, visible: true },
      { id: 2, title: 'Sistemas Operativos', examType: 'Prova', subjectId: 2, schoolYearId: 1, termId: 2, institutionId: 1, classId: 2, durationMinutes: 90, totalMaxScore: 20, variant: null, source: 'MANUAL', needsReview: false, ocrConfidence: null, visible: true },
      { id: 3, title: 'Matemática Discreta', examType: 'Exame', subjectId: 3, schoolYearId: 1, termId: 3, institutionId: 2, classId: 6, durationMinutes: 120, totalMaxScore: 20, variant: 'B', source: 'OCR', needsReview: false, ocrConfidence: 0.87, visible: false },
      // Nunca publicada: tem de dar 404 como se não existisse.
      { id: 4, title: 'Rascunho por publicar', examType: 'Teste', subjectId: 1, schoolYearId: 1, termId: 1, institutionId: 1, classId: 1, durationMinutes: 60, totalMaxScore: 10, variant: null, source: 'OCR', needsReview: true, ocrConfidence: 0.62, visible: false },
    ],
    questions: [
      {
        id: 1, number: 1, text: 'Uma rede de classe A tem, por omissão, um prefixo de:',
        questionType: 'multiple_choice', maxScore: 2, orderIndex: 0,
        options: [
          { id: 11, optionLabel: 'A', optionText: '/8', isCorrect: false, orderIndex: 0 },
          { id: 12, optionLabel: 'B', optionText: '/16', isCorrect: true, orderIndex: 1 },
          { id: 13, optionLabel: 'C', optionText: '/24', isCorrect: false, orderIndex: 2 },
        ],
      },
      {
        id: 2, number: 2, text: 'Quantos hosts utilizáveis tem uma sub-rede /29?',
        questionType: 'multiple_choice', maxScore: 2, orderIndex: 1,
        options: [
          { id: 21, optionLabel: 'A', optionText: '4', isCorrect: false, orderIndex: 0 },
          { id: 22, optionLabel: 'B', optionText: '6', isCorrect: true, orderIndex: 1 },
        ],
      },
      {
        // Sem alternativas: o servidor corrige isto por PENDING_REVIEW, e a sala
        // tem de mostrar uma caixa de texto mesmo que o tipo diga "multiple_choice".
        id: 3, number: 3, text: 'Explica, com as tuas palavras, o que é subnetting.',
        questionType: 'short_answer', maxScore: 4, orderIndex: 2, options: [],
      },
      {
        id: 4, number: 4, text: 'Qual destes endereços é um endereço de multicast?',
        questionType: 'multiple_choice', maxScore: 2, orderIndex: 3,
        options: [
          { id: 41, optionLabel: 'A', optionText: '192.168.1.10', isCorrect: false, orderIndex: 0 },
          { id: 42, optionLabel: 'B', optionText: '224.0.0.1', isCorrect: true, orderIndex: 1 },
          { id: 43, optionLabel: 'C', optionText: '10.0.0.1', isCorrect: false, orderIndex: 2 },
        ],
      },
      {
        id: 5, number: 5, text: 'Ordena as camadas do modelo OSI, da mais baixa para a mais alta.',
        questionType: 'development', maxScore: 4, orderIndex: 4,
        options: [
          { id: 51, optionLabel: 'A', optionText: 'Física, ligação, rede, transporte, sessão', isCorrect: false, orderIndex: 0 },
          { id: 52, optionLabel: 'B', optionText: 'Enlace, rede, física, transporte, sessão', isCorrect: false, orderIndex: 1 },
        ],
      },
    ],
    // One finished, one in progress, one untouched: the three card states. The
    // in-progress one carries a start in the past, so its deadline is real.
    simulations: [
      {
        id: 1, accountId: 3, statementId: 1, status: 'FINISHED', finalScore: 16.4,
        startedAt: toLocalDateTime(new Date(Date.now() - 72 * 3600 * 1000)),
        finishedAt: toLocalDateTime(new Date(Date.now() - 71 * 3600 * 1000)),
        timeSpentSeconds: 3120,
      },
      {
        id: 2, accountId: 3, statementId: 2, status: 'IN_PROGRESS', finalScore: null,
        startedAt: toLocalDateTime(new Date(Date.now() - 20 * 60 * 1000)),
        finishedAt: null, timeSpentSeconds: null,
      },
    ],
    // Uma resposta já guardada na tentativa 2, para se ver a sala a retomar o que
    // ficou em vez de recomeçar: um POST novo na mesma pergunta daria 409.
    answers: [
      // A tentativa 1 está corrigida: duas escolhas, uma certa e uma errada, e uma
      // resposta aberta que fica para o professor. É o que o ecrã de resultado mostra.
      {
        id: 2, simulationId: 1, questionId: 1, selectedOptionId: 12, answerText: null,
        scoreObtained: 2, isCorrect: true, reviewStatus: 'AUTO_GRADED', answeredAt: null,
      },
      {
        id: 3, simulationId: 1, questionId: 2, selectedOptionId: 21, answerText: null,
        scoreObtained: 0, isCorrect: false, reviewStatus: 'AUTO_GRADED', answeredAt: null,
      },
      {
        id: 4, simulationId: 1, questionId: 3, selectedOptionId: null, answerText: 'É dividir uma rede em sub-redes mais pequenas.',
        scoreObtained: null, isCorrect: null, reviewStatus: 'PENDING_REVIEW', answeredAt: null,
      },
      {
        id: 1, simulationId: 2, questionId: 1, selectedOptionId: 12, answerText: null,
        scoreObtained: null, isCorrect: null, reviewStatus: null, answeredAt: null,
      },
    ],
    nextSimulation: 3,
    nextAnswer: 5,
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

function ownedBy(db: Store, simulationId: number, accountId: number): boolean {
  return db.simulations.some((s) => s.id === simulationId && s.accountId === accountId);
}

/** Which questions belong to which statement. The rows keep only what the pure
 *  grading rules need, so the link lives here rather than in simulation.ts. */
const QUESTIONS_BY_STATEMENT: Record<number, number[]> = {
  1: [1, 2, 3, 4, 5],
  2: [1, 2, 3],
  3: [1],
};

/** StatementBasicResponse, as it nests inside SimulationResponse. */
function statementBasic(row: SimulationRow, db: Store) {
  const statement = db.statements.find((s) => s.id === row.statementId);
  if (!statement) return null;
  return {
    id: statement.id,
    examType: statement.examType,
    variant: null,
    title: statement.title,
    durationMinutes: statement.durationMinutes,
    totalMaxScore: statement.totalMaxScore,
  };
}

function statementSummary(db: Store, row: CatalogRow) {
  return {
    id: row.id,
    title: row.title,
    examType: row.examType,
    durationMinutes: row.durationMinutes,
    variant: null,
    instructions: null,
    totalMaxScore: row.totalMaxScore,
    visible: row.visible,
    source: 'MANUAL',
    subjectId: row.subjectId,
    schoolYearId: row.schoolYearId,
    institutionId: row.institutionId,
    classId: row.classId,
    questions: [] as unknown[],
  };
}

/** SimulationResponse. `deadline` is the instant the server stops taking answers,
 *  with the +25% and the tolerance already folded in
 *  (SimulationDeadlineService.java:89) — the room subtracts from this one number. */
function simulationResponse(db: Store, row: SimulationRow) {
  const statement = db.statements.find((s) => s.id === row.statementId);
  const owner = db.accounts.find((a) => a.id === row.accountId);
  return {
    id: row.id,
    account: owner ? { id: owner.id, username: owner.username, email: owner.email } : null,
    statement: statementBasic(row, db),
    schoolYear: null,
    startedAt: row.startedAt,
    finishedAt: row.finishedAt,
    deadline: statement
      ? deadlineFor(row.startedAt, statement.durationMinutes, owner?.accessibilityExtraTime === true)
      : null,
    timeSpentSeconds: row.timeSpentSeconds,
    finalScore: row.finalScore,
    status: row.status,
    createdAt: row.startedAt,
    updatedAt: row.finishedAt,
    deletedAt: null,
  };
}

/** The two conditions a write has to satisfy, in the order the backend checks them
 *  (SimulationAnswerService.java:107-115): a simulation that exists, is still in
 *  progress, and whose deadline has not passed. */
function editableGuard(db: Store, simulationId: number, accountId: number): Response | null {
  const row = db.simulations.find((s) => s.id === simulationId);
  if (!row || row.accountId !== accountId) {
    return problem(403, 'The simulation does not belong to the authenticated account');
  }
  if (row.status !== 'IN_PROGRESS') {
    return problem(409, 'Simulation no longer accepts answers');
  }
  const response = simulationResponse(db, row);
  if (expired(response.deadline)) {
    return problem(409, 'The time allowed for this simulation has expired');
  }
  return null;
}

/** validateSelectedOption: uma questão `open` ou `development` recusa uma opção com
 *  400, MESMO quando tem opções — o backend contradiz-se, porque a correcção decide
 *  por haver opções e esta validação decide pelo tipo. O mock reproduz-o para a sala
 *  não passar só aqui e falhar contra o backend real. */
function optionRefusal(db: Store, questionId: number, selectedOptionId: unknown): Response | null {
  const question = db.questions.find((q) => q.id === questionId);
  if (!question) return problem(404, 'Question not found');
  const type = question.questionType.toLowerCase();
  if (Number(selectedOptionId) && (type === 'open' || type === 'development')) {
    return problem(400, 'Open questions cannot select an option');
  }
  return null;
}

/** Grades everything stored and closes the simulation, the way
 *  SimulationSubmissionService does on submit. */
function closeSimulation(db: Store, row: SimulationRow): void {
  const answers = db.answers.filter((a) => a.simulationId === row.id);
  for (const answer of answers) {
    const question = db.questions.find((q) => q.id === answer.questionId);
    if (question) Object.assign(answer, gradeAnswer(answer, question));
  }
  row.finalScore = finalScore(answers);
  row.status = 'FINISHED';
  row.finishedAt = toLocalDateTime(new Date());
  const start = row.startedAt ? parseServerTime(row.startedAt) : null;
  row.timeSpentSeconds =
    start === null || Number.isNaN(start)
      ? null
      : Math.max(0, Math.round((Date.now() - start) / 1000));
}

function simulationResult(db: Store, row: SimulationRow) {
  const answers = db.answers.filter((a) => a.simulationId === row.id);
  const questions = db.questions.filter((q) => answers.some((a) => a.questionId === q.id));
  const pending = answers.filter((a) => a.reviewStatus === 'PENDING_REVIEW').length;

  return {
    simulationId: row.id,
    status: row.status,
    finalScore: row.finalScore,
    correctAnswers: answers.filter((a) => a.isCorrect === true).length,
    totalQuestions: questions.length,
    pendingReviewCount: pending,
    timeSpentSeconds: row.timeSpentSeconds,
    finishedAt: row.finishedAt,
    questions: questions.map((question) => {
      const answer = answers.find((a) => a.questionId === question.id)!;
      const correct = question.options.find((o) => o.isCorrect);
      return {
        questionId: question.id,
        number: question.number,
        text: question.text,
        questionType: question.questionType,
        maxScore: question.maxScore,
        modelAnswer: null,
        correctOptionId: correct?.id ?? null,
        selectedOptionId: answer.selectedOptionId,
        answerText: answer.answerText,
        scoreObtained: answer.scoreObtained,
        isCorrect: answer.isCorrect,
        reviewStatus: answer.reviewStatus,
        options: question.options.map((o) => ({
          id: o.id,
          optionLabel: o.optionLabel,
          optionText: o.optionText,
          isCorrect: o.isCorrect,
        })),
      };
    }),
  };
}

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
    // Só um administrador o escreve (PATCH /api/v1/accounts/{id}/accessibility), e o
    // backend já o dobroou no `deadline` da simulação: a app só o mostra.
    accessibility_extra_time: account.accessibilityExtraTime,
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
      accessibilityExtraTime: false,
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

  if (pathname === '/simulations' && method === 'GET') {
    const mine = db.simulations.filter((s) => s.accountId === account.id);
    return json(mine.map((s) => simulationResponse(db, s)));
  }

  if (pathname === '/simulations' && method === 'POST') {
    const target = Number(body.accountId);
    const statementId = Number(body.statementId);
    // SimulationService.java:103-105: o accountId tem de ser o da conta
    // autenticada. Sem esta verificação o mock aceitaria criar em nome de outro.
    if (!staff && target !== account.id) {
      return problem(403, 'A simulation can only be created for the authenticated account');
    }
    const statement = db.statements.find((s) => s.id === statementId);
    // Um aluno só começa uma prova que pode ler: publicada, senão 404 como no /full.
    if (!statement || (!staff && !statement.visible)) return problem(404, 'Statement not found');

    const row: SimulationRow = {
      id: db.nextSimulation++,
      accountId: target,
      statementId,
      // O relógio começa no servidor (SimulationService.java:95); o que o cliente
      // mande em startedAt ou status é ignorado, tal como no backend.
      status: 'IN_PROGRESS',
      finalScore: null,
      startedAt: toLocalDateTime(new Date()),
      finishedAt: null,
      timeSpentSeconds: null,
    };
    db.simulations.push(row);
    return json(simulationResponse(db, row), 201);
  }

  // ── a sala de prova ─────────────────────────────────────────────────────────

  const simulationMatch = /^\/simulations\/(\d+)(\/result)?$/.exec(pathname);
  if (simulationMatch && method === 'GET') {
    const id = Number(simulationMatch[1]);
    const row = db.simulations.find((s) => s.id === id && s.accountId === account.id);
    // Fora do dono é 404, não 403 (SimulationResultService.java:70-71): um aluno
    // não fica a saber de que lado está a tentativa de outra pessoa.
    if (!row) return problem(404, 'Simulation not found');
    if (simulationMatch[2]) {
      // SimulationResultService.java:83-90: o resultado só existe depois de FINISHED.
      // É este 409 que esconde o gabarito durante a prova.
      if (row.status !== 'FINISHED') {
        return problem(409, 'The result is only available once the simulation is finished');
      }
      return json(simulationResult(db, row));
    }
    return json(simulationResponse(db, row));
  }

  const submitMatch = /^\/simulations\/(\d+)\/submit$/.exec(pathname);
  if (submitMatch && method === 'POST') {
    const id = Number(submitMatch[1]);
    const row = db.simulations.find((s) => s.id === id && s.accountId === account.id);
    if (!row) return problem(404, 'Simulation not found');
    // SimulationSubmissionService.java:55-57: entregar duas vezes é 409.
    if (row.status !== 'IN_PROGRESS') {
      return problem(409, 'Simulation has already been submitted');
    }
    closeSimulation(db, row);
    return json(simulationResult(db, row));
  }

  if (pathname === '/simulation-answers' && method === 'GET') {
    return json(db.answers.filter((a) => ownedBy(db, a.simulationId, account.id)));
  }

  if (pathname === '/simulation-answers' && method === 'POST') {
    const simulationId = Number(body.simulationId);
    const questionId = Number(body.questionId);
    const guard = editableGuard(db, simulationId, account.id);
    if (guard) return guard;

    // SimulationAnswerService.java:95-99: um segundo POST da mesma pergunta é 409,
    // porque não há upsert. O cliente tem de guardar o id devolvido e usar PUT.
    if (db.answers.some((a) => a.simulationId === simulationId && a.questionId === questionId)) {
      return problem(409, 'This question has already been answered in this simulation.');
    }
    const refused = optionRefusal(db, questionId, body.selectedOptionId);
    if (refused) return refused;
    const answer: MockAnswer = {
      id: db.nextAnswer++,
      simulationId,
      questionId,
      selectedOptionId: Number(body.selectedOptionId) || null,
      answerText: body.answerText === null || body.answerText === undefined ? null : String(body.answerText),
      scoreObtained: null,
      isCorrect: null,
      reviewStatus: null,
      answeredAt: null,
    };
    db.answers.push(answer);
    return json(answer, 201);
  }

  const answerMatch = /^\/simulation-answers\/(\d+)$/.exec(pathname);
  if (answerMatch && method === 'PUT') {
    const existing = db.answers.find((a) => a.id === Number(answerMatch[1]));
    if (!existing || !ownedBy(db, existing.simulationId, account.id)) {
      return problem(404, 'Simulation answer not found');
    }
    const guard = editableGuard(db, existing.simulationId, account.id);
    if (guard) return guard;
    // O enunciado não pode mudar de pergunta a meio: o PUT reescreve a linha com o
    // questionId que vem no corpo, e a chave única (simulação, pergunta) barra-o.
    const refused = optionRefusal(db, existing.questionId, body.selectedOptionId);
    if (refused) return refused;
    existing.selectedOptionId = Number(body.selectedOptionId) || null;
    existing.answerText =
      body.answerText === null || body.answerText === undefined ? null : String(body.answerText);
    return json(existing);
  }

  const fullMatch = /^\/statements\/(\d+)\/full$/.exec(pathname);
  if (fullMatch && method === 'GET') {
    const statement = db.statements.find((s) => s.id === Number(fullMatch[1]));
    if (!statement) return problem(404, 'Statement not found');
    // Um aluno só lê o enunciado publicado (StatementController.java:135). O mock
    // devolve 404 como o backend, para o cartão não abrir uma prova invisível.
    if (!staff && !statement.visible) return problem(404, 'Statement not found');

    const ids = QUESTIONS_BY_STATEMENT[statement.id] ?? [];
    const questions = ids
      .map((qid) => db.questions.find((q) => q.id === qid))
      .filter((q): q is MockQuestion => q !== undefined)
      .map((q) => {
      // O gabarito viaja só com quem é staff (StatementOcrResponse.java:166-173),
      // e o `@JsonInclude(NON_NULL)` tira o campo do JSON em vez de o mandar a
      // null. O mesmo para `modelAnswer`, que nem existe neste DTO. Um mock que
      // mandasse `isCorrect` ao aluno ensinaria a sala a ler o gabarito — e a sala
      // a mostrar a resposta certa antes de entregar.
      const body = {
        ...q,
        needsReview: staff ? false : undefined,
        ocrConfidence: staff ? 0.98 : undefined,
      };
      return {
        ...body,
        options: q.options.map((o) => ({
          id: o.id,
          optionLabel: o.optionLabel,
          optionText: o.optionText,
          orderIndex: o.orderIndex,
          ...(staff ? { isCorrect: o.isCorrect, ocrConfidence: 0.98 } : {}),
        })),
      };
    });
    return json({
      ...statementSummary(db, statement),
      needsReview: staff ? false : undefined,
      ocrConfidence: staff ? 0.98 : undefined,
      questions,
    });
  }

  const imagesMatch = /^\/question-images\/question\/(\d+)$/.exec(pathname);
  if (imagesMatch && method === 'GET') {
    const questionId = Number(imagesMatch[1]);
    // Uma imagem por questão, para se ver o caminho que a sala percorre. As URLs
    // são do armazenamento do backend; aqui são locais, o resto do contrato é igual.
    return json(
      questionId === 1
        ? [
            {
              id: 1,
              questionId,
              imageUrl: "data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 320 80'%3E%3Crect width='320' height='80' fill='%23eef'/%3E%3Ctext x='160' y='47' text-anchor='middle' font-family='sans-serif' font-size='18'%3E192.168.1.0/29%3C/text%3E%3C/svg%3E",
              caption: 'Divisão de um endereço em rede e host',
              orderIndex: 0,
              createdAt: null,
              updatedAt: null,
              deletedAt: null,
            },
          ]
        : [],
    );
  }

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
