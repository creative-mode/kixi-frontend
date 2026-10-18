import 'server-only';
import { countLeafQuestions } from './leaf-count';
import { catalogPage } from './catalog-page';
import { findVisible, summaryOf } from './statement-detail';
import { resolveSchoolId } from './school';
import { isRestricted, isVisibility, matchesSearch, type Visibility } from './profiles';
import * as friends from './friends';
import { institutionsCounted as countInstitutions, rankGlobal } from './global-ranking';
import { effectiveFault, normalizeFault, type Fault } from './fault';
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
import { invitationsOf, join, roomDeadline, studentView, type MockParticipant, type MockRoom } from './exam-rooms';
import { conversation, type MockPostComment } from './feed-comments';
import { payloadOf, problemOf, summaryOf as blocksSummary, type BuiltKind, type PostBlock } from '../post-blocks';
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

/** A falha em vigor: a mudada em runtime por `setFault` (para o e2e ligar e desligar a falha sem
 *  reiniciar o servidor) ou, na falta dela, a do ambiente. */
export const currentFault = (): Fault => effectiveFault(G.__kixiFault, FAULT);

export function setFault(mode: string): void {
  G.__kixiFault = normalizeFault(mode);
}

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
  /** Só nas simulações de uma sala de prova (FE-14). */
  examRoomId?: number | null;
};

type Store = {
  accounts: Account[];
  nextAccount: number;
  /** Amizades (kixi#121); o ranking de amigos só conta as aceites. */
  friendships: friends.Friendship[];
  nextFriendship: number;
  /** Quem aceitou ser comparado com outras escolas (ADR-0013); sem entrada, não. */
  crossConsent: number[];
  /** Quem pode ver o perfil de cada conta (#336); sem entrada vale 'school'. */
  visibility: Record<number, string>;
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
  /** Sessões do tutor: a (conta, enunciado) a que cada id pertence e o contexto da
   *  sessão (#115), mais quantas mensagens a conta já enviou para o limite. */
  chatSessions: {
    id: number;
    accountId: number;
    statementId: number;
    mode: 'GENERAL' | 'EXPLAIN_QUESTION' | 'SIMILAR_EXERCISES' | 'CONCEPT';
    questionId: number | null;
    selectedOptionId: number | null;
    studentAnswer: string | null;
  }[];
  chatSent: Record<number, number>;
  /** The institution each student profile belongs to; an administrator sets this. */
  institutionByAccount: Record<number, number>;
  /** Salas de prova e convites (BE-16), com as regras em ./exam-rooms. */
  rooms: MockRoom[];
  participants: MockParticipant[];
  /** Gamificação (#118): um UserStatsResponse por conta. */
  userStats: Record<number, MockUserStats>;
  /** Medalhas desbloqueadas por conta (UserBadgeResponse[]). */
  userBadges: Record<number, MockUserBadge[]>;
  /** Feed social da turma/escola (#120). */
  posts: MockPost[];
  nextPost: number;
  /** A conversa de cada publicação (#179): existe no backend desde o GET, e o mock
   *  guarda-a para o painel ter o que mostrar em modo de demonstração. */
  postComments: MockPostComment[];
  nextPostComment: number;
  postReactions: { postId: number; accountId: number; type: string }[];
  /** Resoluções partilhadas (#119/#32), uma por simulação - partilhar de novo substitui
   *  a anterior em vez de duplicar, como o `unique(account_id, statement_id)` real. */
  solutionShares: MockSolutionShare[];
  nextShare: number;
};

type MockSolutionShare = {
  id: number;
  simulationId: number;
  anonymous: boolean;
  displayName: string | null;
  consentAt: string;
};

type MockPost = {
  id: number;
  authorAccountId: number;
  institutionId: number;
  schoolYearId: number;
  courseId: number;
  classId: number;
  type: string;
  title: string | null;
  content: string;
  isAutoGenerated: boolean;
  commentCount: number;
  createdAt: string;
  updatedAt: string;
  /** Posts construídos (kixi#347): a lista de blocos; ausente nos simples. */
  blocks?: PostBlock[];
  /** Só no tipo `simulation`: instantâneo tirado ao publicar, como no backend. */
  simulation?: {
    simulationId: number; statementTitle: string | null; schoolName: string | null;
    finalScore: number | null; maxScore: number | null;
    correctAnswers: number | null; totalQuestions: number | null; timeSpentSeconds: number | null;
  };
};

type MockUserStats = {
  accountId: number;
  xp: number;
  level: number;
  streak: number;
  longestStreak: number;
  freePauses: number;
  lastActivityDate: string | null;
};

type MockUserBadge = {
  code: string;
  name: string;
  description: string;
  subjectId: number | null;
  unlockedAt: string;
};

const G = globalThis as unknown as { __kixiStudentMock?: Store; __kixiFault?: Fault };

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
    // Escola criada mas ainda sem turmas: não aparece no onboarding (onlyWithClassesInYear).
    { id: 3, code: 'IMIL', name: 'Instituto Médio Industrial de Luanda', short_name: 'IMIL', logo: null },
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
    // Colegas para o ranking (#117/#31) ter com quem comparar: Nuno e Sara na
    // mesma turma do aluno 3, Inês na mesma escola mas noutra turma.
    account(4, 'nuno.dias', 'nuno.dias@kixi.ao', 'STUDENT', 'Nuno', 'Dias'),
    account(5, 'sara.pinto', 'sara.pinto@kixi.ao', 'STUDENT', 'Sara', 'Pinto'),
    account(6, 'ines.lopes', 'ines.lopes@kixi.ao', 'STUDENT', 'Inês', 'Lopes'),
  ];

  return {
    accounts,
    nextAccount: 7,
    // A Sara já é amiga do aluno; o Nuno pediu e espera resposta.
    friendships: [
      { id: 1, requesterId: 3, addresseeId: 5, accepted: true },
      { id: 2, requesterId: 4, addresseeId: 3, accepted: false },
    ],
    nextFriendship: 3,
    crossConsent: [],
    visibility: { 5: 'private' },
    institutions,
    courses,
    schoolYears,
    classes,
    enrollments: [
      { id: 1, accountId: 3, classId: 1, schoolYearId: 1, status: 'ACTIVE' },
      { id: 2, accountId: 4, classId: 1, schoolYearId: 1, status: 'ACTIVE' },
      { id: 3, accountId: 5, classId: 1, schoolYearId: 1, status: 'ACTIVE' },
      { id: 4, accountId: 6, classId: 2, schoolYearId: 1, status: 'ACTIVE' },
    ],
    nextEnrollment: 5,
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
      // A prova de OGI com alíneas: V/F (2a, 2b) e uma composta (4a, 4b). Serve para o aluno ver o enunciado comum.
      { id: 5, title: 'Organização e Gestão Industrial', examType: 'Exame', subjectId: 1, schoolYearId: 1, termId: 1, institutionId: 1, classId: 1, durationMinutes: 90, totalMaxScore: 20, variant: 'B', source: 'MANUAL', needsReview: false, ocrConfidence: null, visible: true },
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
      // ── prova de OGI (enunciado 5): aberta, V/F com alíneas, aberta, composta com alíneas ──
      { id: 101, number: 1, text: 'O que consiste o aprovisionamento em uma organização empresarial?', questionType: 'open', maxScore: 4, orderIndex: 0, options: [] },
      { id: 102, number: 2, text: 'Para cada uma das questões abaixo, diga quais são verdadeiras (V) ou falsas (F):', questionType: 'group', maxScore: 0, orderIndex: 1, options: [] },
      {
        id: 103, number: 201, parentId: 102, label: 'a', text: 'Deve ser preocupação da organização comprar ao melhor preço possível estabelecido pelo produtor',
        questionType: 'true_false', maxScore: 2, orderIndex: 2,
        options: [
          { id: 1031, optionLabel: 'A', optionText: 'Verdadeiro', isCorrect: true, orderIndex: 0 },
          { id: 1032, optionLabel: 'B', optionText: 'Falso', isCorrect: false, orderIndex: 1 },
        ],
      },
      {
        id: 104, number: 202, parentId: 102, label: 'b', text: 'A escolha das matérias só deve ser feita após a determinação das possíveis aplicações',
        questionType: 'true_false', maxScore: 2, orderIndex: 3,
        options: [
          { id: 1041, optionLabel: 'A', optionText: 'Verdadeiro', isCorrect: false, orderIndex: 0 },
          { id: 1042, optionLabel: 'B', optionText: 'Falso', isCorrect: true, orderIndex: 1 },
        ],
      },
      { id: 105, number: 3, text: 'Explique e esquematize as fases que abrange o planeamento dentro de uma organização.', questionType: 'open', maxScore: 4, orderIndex: 4, options: [] },
      { id: 106, number: 4, text: 'Uma empresa utiliza o Lote Económico para repor o estoque de uma das suas peças. O lote previsto é de 6000 unidades diárias e a demanda é de 90 mil unidades mensais.', questionType: 'group', maxScore: 0, orderIndex: 5, options: [] },
      { id: 107, number: 401, parentId: 106, label: 'a', text: 'Demonstre a expressão matemática para o cálculo do custo de manutenção de estoques.', questionType: 'open', maxScore: 4, orderIndex: 6, options: [] },
      { id: 108, number: 402, parentId: 106, label: 'b', text: 'Calcule o custo de manutenção de estoques anual e mensal.', questionType: 'open', maxScore: 4, orderIndex: 7, options: [] },
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
      // Duas tentativas de outras contas na mesma prova (#119/#32): sem elas a
      // comunidade tinha sempre sampleSize=1 e nenhuma distribuição real para mostrar.
      // Não são contas de verdade (não há linha em `accounts`) - a comunidade só
      // precisa da nota, nunca da identidade.
      {
        id: 3, accountId: 101, statementId: 1, status: 'FINISHED', finalScore: 12.0,
        startedAt: toLocalDateTime(new Date(Date.now() - 48 * 3600 * 1000)),
        finishedAt: toLocalDateTime(new Date(Date.now() - 47 * 3600 * 1000)),
        timeSpentSeconds: 2800,
      },
      {
        id: 4, accountId: 102, statementId: 1, status: 'FINISHED', finalScore: 8.5,
        startedAt: toLocalDateTime(new Date(Date.now() - 24 * 3600 * 1000)),
        finishedAt: toLocalDateTime(new Date(Date.now() - 23 * 3600 * 1000)),
        timeSpentSeconds: 3600,
      },
      // Tentativas dos colegas matriculados (#117/#31), para o ranking de turma e
      // de escola teres uma distribuição real em vez de uma lista com um nome só.
      {
        id: 5, accountId: 4, statementId: 1, status: 'FINISHED', finalScore: 18.0,
        startedAt: toLocalDateTime(new Date(Date.now() - 50 * 3600 * 1000)),
        finishedAt: toLocalDateTime(new Date(Date.now() - 49 * 3600 * 1000)),
        timeSpentSeconds: 2600,
      },
      {
        id: 6, accountId: 5, statementId: 1, status: 'FINISHED', finalScore: 11.5,
        startedAt: toLocalDateTime(new Date(Date.now() - 30 * 3600 * 1000)),
        finishedAt: toLocalDateTime(new Date(Date.now() - 29 * 3600 * 1000)),
        timeSpentSeconds: 3300,
      },
      {
        id: 7, accountId: 6, statementId: 1, status: 'FINISHED', finalScore: 19.5,
        startedAt: toLocalDateTime(new Date(Date.now() - 10 * 3600 * 1000)),
        finishedAt: toLocalDateTime(new Date(Date.now() - 9 * 3600 * 1000)),
        timeSpentSeconds: 2200,
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
    nextSimulation: 8,
    nextAnswer: 5,
    chatSessions: [],
    chatSent: {},
    // The seeded student is also explicitly affiliated with ITEL, as an administrator
    // would have done, so /me can be seen answering with the linked school. An account
    // created through /auth/register has no link and gets the school of its class.
    institutionByAccount: { 3: 1 },
    // Três salas para o aluno da semente, uma por estado que a página mostra: a
    // decorrer (entra e responde), aberta mais tarde (sala de espera) e encerrada.
    // A prova é a 3, que não está publicada: a sala não passa pelo catálogo.
    rooms: [
      { id: 1, statementId: 3, status: 'RUNNING', startsAt: toLocalDateTime(new Date(Date.now() - 10 * 60_000)), endsAt: toLocalDateTime(new Date(Date.now() + 80 * 60_000)), durationMinutes: 45 },
      { id: 2, statementId: 3, status: 'OPEN', startsAt: toLocalDateTime(new Date(Date.now() + 2 * 3_600_000)), endsAt: toLocalDateTime(new Date(Date.now() + 3 * 3_600_000)), durationMinutes: 45 },
      { id: 3, statementId: 1, status: 'CLOSED', startsAt: toLocalDateTime(new Date(Date.now() - 26 * 3_600_000)), endsAt: toLocalDateTime(new Date(Date.now() - 25 * 3_600_000)), durationMinutes: 45 },
    ],
    participants: [
      { roomId: 1, accountId: 3, simulationId: null, joinedAt: null },
      { roomId: 2, accountId: 3, simulationId: null, joinedAt: null },
      { roomId: 3, accountId: 3, simulationId: null, joinedAt: null },
    ],
    // Consistente com a única simulação terminada da semente (RED, 16,4/20): XP de
    // uma prova, nível 1, sequência de 1 dia (hoje), e a medalha que esse resultado
    // já desbloqueia. streak_30_days e topic_mastered ficam por desbloquear.
    userStats: {
      3: {
        accountId: 3, xp: 120, level: 1, streak: 1, longestStreak: 3, freePauses: 1,
        lastActivityDate: toLocalDateTime(new Date()).slice(0, 10),
      },
    },
    userBadges: {
      3: [
        {
          code: 'FIRST_SIMULATION', name: 'Primeira prova', description: 'Concluiu a primeira simulação.',
          subjectId: null, unlockedAt: toLocalDateTime(new Date(Date.now() - 71 * 3600 * 1000)),
        },
      ],
    },
    // A turma 1 (12B, ITEL, ano 1) é a matrícula do aluno 3 - mesma turma do post, para
    // GET /feed/posts?classId=1 devolver algo sem precisar de outra conta a publicar.
    posts: [
      {
        id: 1, authorAccountId: 3, institutionId: 1, schoolYearId: 1, courseId: 1, classId: 1,
        type: 'doubt', title: null,
        content: 'Alguém me explica subnetting de outra forma? Fico sempre confuso nos /29.',
        isAutoGenerated: false, commentCount: 2,
        createdAt: toLocalDateTime(new Date(Date.now() - 3 * 3600 * 1000)),
        updatedAt: toLocalDateTime(new Date(Date.now() - 3 * 3600 * 1000)),
      },
      {
        id: 2, authorAccountId: 4, institutionId: 1, schoolYearId: 1, courseId: 1, classId: 1,
        type: 'topic', title: null,
        content: 'Resumo rápido: o /28 tem 16 endereços, mas só 14 servem para máquinas.',
        isAutoGenerated: false, commentCount: 0,
        createdAt: toLocalDateTime(new Date(Date.now() - 2 * 3600 * 1000)),
        updatedAt: toLocalDateTime(new Date(Date.now() - 2 * 3600 * 1000)),
      },
      {
        id: 3, authorAccountId: 4, institutionId: 1, schoolYearId: 1, courseId: 1, classId: 1,
        type: 'challenge', title: 'Desafio de sub-redes',
        content: 'Quantas máquinas cabem numa rede /28?\n- 12\n- 14\n- 16',
        isAutoGenerated: false, commentCount: 0,
        createdAt: toLocalDateTime(new Date(Date.now() - 1 * 3600 * 1000)),
        updatedAt: toLocalDateTime(new Date(Date.now() - 1 * 3600 * 1000)),
        blocks: [
          { type: 'text', text: 'Pensa antes de abrires a resposta.' },
          { type: 'choice', text: 'Quantas máquinas cabem numa rede /28?', items: ['12', '14', '16'], correct: 1, explanation: 'Um /28 tem 16 endereços, mas o primeiro é o da rede e o último é o de difusão.' },
        ],
      },
    ],
    nextPost: 3,
    postComments: [
      {
        id: 1, postId: 1, authorAccountId: 4, content: 'Se o /29 dá 8 endereços, o /28 dá 16 - e o /30 dá só 4.',
        isHidden: false, createdAt: toLocalDateTime(new Date(Date.now() - 2 * 3600 * 1000)),
        updatedAt: toLocalDateTime(new Date(Date.now() - 2 * 3600 * 1000)),
      },
      {
        id: 2, postId: 1, authorAccountId: 3, content: 'Isso foi o que me destravou. Obrigado!',
        isHidden: false, createdAt: toLocalDateTime(new Date(Date.now() - 95 * 60 * 1000)),
        updatedAt: toLocalDateTime(new Date(Date.now() - 95 * 60 * 1000)),
      },
    ],
    nextPostComment: 3,
    postReactions: [],
    solutionShares: [
      { id: 1, simulationId: 3, anonymous: true, displayName: null, consentAt: toLocalDateTime(new Date(Date.now() - 46 * 3600 * 1000)) },
    ],
    nextShare: 2,
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

/** O nome mascarado de uma conta, como o ranking e a conversa o recebem (#179):
 *  primeiro nome e inicial do apelido. Sem perfil, sem nome. */
function maskedName(db: Store, id: number): string | null {
  const account = db.accounts.find((x) => x.id === id);
  if (!account?.firstName || !account.lastName) return null;
  return `${account.firstName} ${account.lastName.charAt(0)}.`;
}

function ownedBy(db: Store, simulationId: number, accountId: number): boolean {
  return db.simulations.some((s) => s.id === simulationId && s.accountId === accountId);
}

/** Which questions belong to which statement. The rows keep only what the pure
 *  grading rules need, so the link lives here rather than in simulation.ts. */
const QUESTIONS_BY_STATEMENT: Record<number, number[]> = {
  1: [1, 2, 3, 4, 5],
  2: [1, 2, 3],
  // Três questões, para a sala de prova da semente ter o que responder.
  3: [1, 2, 4],
  // OGI: as folhas e, no meio, os enunciados comuns (que o aluno não responde).
  5: [101, 102, 103, 104, 105, 106, 107, 108],
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
/** Numa sala, o prazo é a duração da sala sem passar o fecho (SimulationDeadlineService). */
function roomDeadlineOf(db: Store, row: SimulationRow): string | null {
  if (!row.examRoomId || !row.startedAt) return null;
  const room = db.rooms.find((r) => r.id === row.examRoomId);
  return room ? roomDeadline(row.startedAt, room.durationMinutes, room.endsAt) : null;
}

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
    deadline: roomDeadlineOf(db, row) ?? (statement
      ? deadlineFor(row.startedAt, statement.durationMinutes, owner?.accessibilityExtraTime === true)
      : null),
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
    // O total é o da prova, e não só o das questões respondidas: «0 de 5» e não «0 de 1».
    totalQuestions: countLeafQuestions(QUESTIONS_BY_STATEMENT[row.statementId] ?? [], db.questions.map((q) => q.parentId)) || questions.length,
    pendingReviewCount: pending,
    timeSpentSeconds: row.timeSpentSeconds,
    finishedAt: row.finishedAt,
    questions: questions.map((question) => {
      const answer = answers.find((a) => a.questionId === question.id)!;
      const correct = question.options.find((o) => o.isCorrect);
      const parent = question.parentId != null ? db.questions.find((q) => q.id === question.parentId) : undefined;
      return {
        questionId: question.id,
        number: question.number,
        text: question.text,
        questionType: question.questionType,
        // As alíneas dizem a que questão pertencem e levam o enunciado comum (`parentText`).
        ...(parent ? { parentId: parent.id, label: question.label ?? null, parentText: parent.text } : {}),
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

function tutorSources(
  statement: CatalogRow | undefined,
  question: MockQuestion | null,
  mode: 'GENERAL' | 'EXPLAIN_QUESTION' | 'SIMILAR_EXERCISES' | 'CONCEPT',
) {
  return [
    {
      kind: 'STATEMENT',
      statementId: statement?.id ?? null,
      statementTitle: statement?.title ?? null,
      questionId: null,
      questionNumber: null,
    },
    ...(question
      ? [{
          kind: mode === 'SIMILAR_EXERCISES' ? 'CATALOG_QUESTION' : 'QUESTION',
          statementId: statement?.id ?? null,
          statementTitle: statement?.title ?? null,
          questionId: question.id,
          questionNumber: question.number,
        }]
      : []),
  ];
}

export async function mockHandle(
  method: string,
  path: string,
  token: string | null,
  bodyText: string,
): Promise<Response> {
  const fault = currentFault();
  if (fault === 'timeout') throw new TypeError('fetch failed');
  if (fault === '500') {
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

  // Gamificação (#118): quem nunca terminou uma simulação não tem XP nenhum, não um
  // 404 — a mesma razão de user_stats não ter linha a menos que algo a tenha criado.
  if (pathname === '/me/stats' && method === 'GET') {
    const stats = db.userStats[account.id] ?? {
      accountId: account.id, xp: 0, level: 1, streak: 0, longestStreak: 0, freePauses: 1,
      lastActivityDate: null,
    };
    return json(stats);
  }

  if (pathname === '/me/badges' && method === 'GET') {
    return json(db.userBadges[account.id] ?? []);
  }

  // ── amizades (kixi#121): o FriendshipService, com as regras em ./friends ──────
  if (pathname.startsWith('/friends') && accountId !== null) {
    const me = accountId;
    const nameOf = (id: number) => maskedName(db, id) ?? 'Aluno';
    if (pathname === '/friends' && method === 'GET') return json(friends.listFriends(db.friendships, me, nameOf));
    if (pathname === '/friends/requests' && method === 'GET') return json(friends.listRequests(db.friendships, me, nameOf));
    if (pathname === '/friends/search' && method === 'GET') {
      const mineEnrollment = db.enrollments.find((e) => e.accountId === me && e.status === 'ACTIVE');
      if (!mineEnrollment) return problem(409, 'An active enrollment in a school is needed to search colleagues');
      const colleagues = db.enrollments
        .filter((e) => e.status === 'ACTIVE' && e.schoolYearId === mineEnrollment.schoolYearId)
        .map((e) => ({ id: e.accountId, name: nameOf(e.accountId) }));
      return json(friends.searchable(db.friendships, me, colleagues, search.get('q') ?? ''));
    }
    if (pathname === '/friends' && method === 'POST') {
      const made = friends.request(db.friendships, me, body.accountId, db.nextFriendship);
      if (!made.ok) return problem(made.status, made.message);
      const target = Number(body.accountId);
      const mineEnrollment = db.enrollments.find((e) => e.accountId === me && e.status === 'ACTIVE');
      const same = db.enrollments.some((e) => e.accountId === target && e.status === 'ACTIVE' && e.schoolYearId === mineEnrollment?.schoolYearId);
      if (!same) return problem(400, 'That colleague is not in your school this year');
      db.nextFriendship += 1;
      db.friendships.push(made.value);
      return json(friends.viewOf(made.value, me, nameOf), 201);
    }
    const act = pathname.match(/^\/friends\/(\d+)(\/accept)?$/);
    if (act && act[2] && method === 'POST') {
      const done = friends.accept(db.friendships, me, Number(act[1]));
      if (!done.ok) return problem(done.status, done.message);
      done.value.accepted = true;
      return json(friends.viewOf(done.value, me, nameOf));
    }
    if (act && !act[2] && method === 'DELETE') {
      const done = friends.remove(db.friendships, me, Number(act[1]));
      if (!done.ok) return problem(done.status, done.message);
      db.friendships = db.friendships.filter((r) => r.id !== done.value.id);
      return new Response(null, { status: 204 });
    }
  }

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

  // ── feed social da turma/escola (#120/#30) ──────────────────────────────────
  // Isolamento como o backend real: a turma pedida tem de ser uma onde a conta
  // está matriculada (não confiamos em classId só porque veio do cliente).
  if (pathname === '/feed/posts' && method === 'GET') {
    const classId = filter('classId');
    const myClasses = new Set(
      db.enrollments.filter((e) => e.accountId === account.id && e.status === 'ACTIVE').map((e) => e.classId),
    );
    if (classId !== undefined && !myClasses.has(classId)) return problem(403, 'Not in your scope');
    const page = filter('page') ?? 1;
    const limit = filter('limit') ?? 10;
    const scoped = db.posts
      .filter((p) => myClasses.has(p.classId) && (classId === undefined || p.classId === classId))
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    const start = (page - 1) * limit;
    return json(
      scoped.slice(start, start + limit).map((p) => ({
        ...p,
        hasReacted: db.postReactions.some((r) => r.postId === p.id && r.accountId === account.id),
      })),
    );
  }

  if (pathname === '/feed/posts' && method === 'POST') {
    const type = text('type').toLowerCase();
    const classId = Number(body.classId);
    const isSimulation = type === 'simulation';
    if (!['doubt', 'topic', 'simulation', 'study_card', 'solution', 'challenge'].includes(type)) return problem(400, 'Post type is required');
    if (!Number.isInteger(classId)) return problem(400, 'classId is required');
    // Como o backend: com blocos, o conteúdo é o resumo deles; os tipos construídos exigem blocos.
    const blocks = Array.isArray(body.blocks) ? payloadOf(body.blocks as PostBlock[]) : [];
    if (isSimulation && blocks.length > 0) return problem(400, 'A SIMULATION post has no blocks');
    if (['study_card', 'solution', 'challenge'].includes(type) && blocks.length === 0) return problem(400, 'This post type needs blocks');
    if (blocks.length > 0) {
      const invalid = problemOf(type as BuiltKind, text('title'), blocks);
      if (invalid) return problem(400, invalid);
    }
    const content = blocks.length > 0 ? blocksSummary(blocks) : text('content');
    if (isSimulation ? content.length > 2000 : content.length < 5 || content.length > 2000) {
      return problem(400, 'Content cannot be empty');
    }
    const enrolled = db.enrollments.some(
      (e) => e.accountId === account.id && e.classId === classId && e.status === 'ACTIVE',
    );
    if (!enrolled) return problem(403, 'Not in your scope');
    const klass = db.classes.find((c) => c.id === classId);
    if (!klass) return problem(404, 'Class not found');
    let simulation: MockPost['simulation'];
    if (isSimulation) {
      const sim = db.simulations.find((x) => x.id === Number(body.simulationId) && x.accountId === account.id);
      if (!sim) return problem(404, 'Simulation not found');
      if (sim.status !== 'FINISHED') return problem(409, 'Simulation is not finished');
      if (db.posts.some((p) => p.simulation?.simulationId === sim.id)) return problem(409, 'This simulation was already published');
      const statement = db.statements.find((x) => x.id === sim.statementId);
      simulation = {
        simulationId: sim.id,
        statementTitle: statement?.title ?? null,
        schoolName: db.institutions.find((i) => i.id === klass.institutionId)?.name ?? null,
        finalScore: sim.finalScore, maxScore: statement?.totalMaxScore ?? null,
        correctAnswers: null, totalQuestions: null, timeSpentSeconds: sim.timeSpentSeconds,
      };
    }
    const now = toLocalDateTime(new Date());
    const post: MockPost = {
      id: db.nextPost++,
      authorAccountId: account.id,
      institutionId: klass.institutionId,
      schoolYearId: klass.schoolYearId,
      courseId: klass.courseId,
      classId,
      type,
      title: text('title') || null,
      content,
      isAutoGenerated: false,
      commentCount: 0,
      createdAt: now,
      updatedAt: now,
      ...(blocks.length > 0 ? { blocks } : {}),
      ...(simulation ? { simulation } : {}),
    };
    db.posts.unshift(post);
    return json({ ...post, hasReacted: false }, 201);
  }

  const reactionMatch = pathname.match(/^\/feed\/posts\/(\d+)\/reactions$/);
  if (reactionMatch && method === 'POST') {
    const postId = Number(reactionMatch[1]);
    const type = text('reaction').toLowerCase();
    if (!['applause', 'strength'].includes(type)) return problem(400, 'Reaction type is required');
    if (!db.posts.some((p) => p.id === postId)) return problem(404, 'Post not found');
    const existing = db.postReactions.findIndex(
      (r) => r.postId === postId && r.accountId === account.id && r.type === type,
    );
    if (existing >= 0) {
      db.postReactions.splice(existing, 1);
      return json({ reacted: false });
    }
    db.postReactions.push({ postId, accountId: account.id, type });
    return json({ reacted: true });
  }

  const commentMatch = pathname.match(/^\/feed\/posts\/(\d+)\/comments$/);
  if (commentMatch && method === 'POST') {
    const postId = Number(commentMatch[1]);
    const content = text('content');
    const post = db.posts.find((p) => p.id === postId);
    if (!post) return problem(404, 'Post not found');
    if (!content || content.length > 500) return problem(400, 'Comment content cannot be empty');
    const comment = {
      id: db.nextPostComment,
      postId,
      authorAccountId: account.id,
      content,
      isHidden: false,
      createdAt: toLocalDateTime(new Date()),
      updatedAt: toLocalDateTime(new Date()),
    };
    db.nextPostComment += 1;
    db.postComments.push(comment);
    post.commentCount = db.postComments.filter((c) => c.postId === postId).length;
    return json({ ...comment, mine: true, displayName: maskedName(db, account.id) }, 201);
  }

  // A conversa, do mais antigo para o mais novo, como o backend (#179). Um post de outra
  // turma é 404 e não uma lista vazia: o id veio do URL e um vazio diria que não há nada.
  if (commentMatch && method === 'GET') {
    const postId = Number(commentMatch[1]);
    const myClasses = new Set(
      db.enrollments.filter((e) => e.accountId === account.id && e.status === 'ACTIVE').map((e) => e.classId),
    );
    const rows = conversation(
      db.postComments.filter((c) => c.postId === postId),
      db.posts.some((p) => p.id === postId && myClasses.has(p.classId)),
      account.id,
      (id) => maskedName(db, id),
      filter('page') ?? 1,
      filter('limit') ?? 20,
    );
    if (!Array.isArray(rows)) return problem(rows.status, rows.message);
    return json(rows);
  }

  const reportMatch = pathname.match(/^\/feed\/posts\/(\d+)\/reports$/);
  if (reportMatch && method === 'POST') {
    const postId = Number(reportMatch[1]);
    const reason = text('reason');
    if (!db.posts.some((p) => p.id === postId)) return problem(404, 'Post not found');
    if (!reason) return problem(400, 'Report reason is required');
    return json({ id: 1, postId, reporterAccountId: account.id, reason }, 201);
  }

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

  // ── perfis (#331/#336/#338): escolas, pessoas, pesquisa ───────────────────────
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
      const visibility = db.visibility[target.id] ?? 'school';
      const mine = accountId === target.id;
      const restricted = isRestricted(visibility as Visibility, mine);
      const classIds = db.enrollments.filter((e) => e.accountId === target.id).map((e) => e.classId);
      const schoolIds = new Set(db.classes.filter((c) => classIds.includes(c.id)).map((c) => c.institutionId));
      return json({
        userId: target.id,
        displayName: `${target.firstName} ${target.lastName}`,
        photo: target.photo,
        kind: target.roles.includes('TEACHER') ? 'TEACHER' : 'STUDENT',
        verified: target.roles.includes('TEACHER'),
        restricted,
        visibility,
        schools: restricted
          ? []
          : db.institutions.filter((i) => schoolIds.has(i.id) || (target.roles.includes('TEACHER') && i.id === 1)).map(card),
        level: restricted ? null : 3,
        xp: restricted ? null : 240,
        badges: restricted ? [] : ['Primeira prova'],
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

  // ── comunidade e partilha de resoluções (#119/#32) ──────────────────────────
  const community = pathname.match(/^\/statements\/(\d+)\/community$/);
  if (community && method === 'GET') {
    const statementId = Number(community[1]);
    const finished = db.simulations.filter((s) => s.statementId === statementId && s.status === 'FINISHED');
    const mine = finished.find((s) => s.accountId === account.id) ?? null;
    const scores = finished.map((s) => s.finalScore).filter((v): v is number => v != null);
    const mean = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
    return json({
      statementId,
      sampleSize: scores.length,
      meanScore: mean,
      medianScore: mean,
      scoreDistribution: scores.length
        ? [
            { index: 0, from: 0, to: 10, count: scores.filter((s) => s < 10).length },
            { index: 1, from: 10, to: 15, count: scores.filter((s) => s >= 10 && s < 15).length },
            { index: 2, from: 15, to: null, count: scores.filter((s) => s >= 15).length },
          ]
        : [],
      questions: [],
      avgTimeSpentSeconds: null,
      timeSampleSize: 0,
      mine: mine ? { simulationId: mine.id, finalScore: mine.finalScore } : null,
    });
  }

  const solutionsMatch = pathname.match(/^\/statements\/(\d+)\/community\/solutions$/);
  if (solutionsMatch && method === 'GET') {
    const statementId = Number(solutionsMatch[1]);
    const institutionId = filter('institutionId');
    const shares = db.solutionShares.filter((sh) => {
      const sim = db.simulations.find((s) => s.id === sh.simulationId);
      if (!sim || sim.statementId !== statementId) return false;
      if (institutionId === undefined) return true;
      return db.institutionByAccount[sim.accountId] === institutionId;
    });
    return json({
      content: shares.map((sh) => {
        const sim = db.simulations.find((s) => s.id === sh.simulationId);
        const schoolId = sim ? db.institutionByAccount[sim.accountId] : undefined;
        const school = schoolId ? db.institutions.find((i) => i.id === schoolId) : undefined;
        return {
          shareId: sh.id,
          institution: !sh.anonymous && school ? { id: school.id, code: school.code } : null,
          authorName: sh.anonymous ? null : sh.displayName,
          finalScore: sim?.finalScore ?? null,
          timeSpentSeconds: sim?.timeSpentSeconds ?? null,
          answers: [],
        };
      }),
      page: 0, size: shares.length, totalElements: shares.length, totalPages: 1,
    });
  }

  const shareMatch = pathname.match(/^\/simulations\/(\d+)\/share$/);
  if (shareMatch && method === 'POST') {
    const simulationId = Number(shareMatch[1]);
    const sim = db.simulations.find((s) => s.id === simulationId && s.accountId === account.id);
    if (!sim) return problem(404, 'Simulation not found');
    if (sim.status !== 'FINISHED') return problem(409, 'Only a finished simulation can be shared');
    const anonymous = body.anonymous !== false;
    const displayName = text('displayName') || null;
    db.solutionShares = db.solutionShares.filter((sh) => sh.simulationId !== simulationId);
    const share = { id: db.nextShare++, simulationId, anonymous, displayName, consentAt: toLocalDateTime(new Date()) };
    db.solutionShares.push(share);
    return json(
      { shareId: share.id, simulationId, anonymous, displayName, consentAt: share.consentAt },
      201,
    );
  }
  if (shareMatch && method === 'DELETE') {
    const simulationId = Number(shareMatch[1]);
    const sim = db.simulations.find((s) => s.id === simulationId && s.accountId === account.id);
    if (!sim) return problem(404, 'Simulation not found');
    db.solutionShares = db.solutionShares.filter((sh) => sh.simulationId !== simulationId);
    return new Response(null, { status: 204 });
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

  // ── salas de prova (FE-14) ─────────────────────────────────────────────────
  if (pathname === '/exam-rooms/mine' && method === 'GET') {
    return json(invitationsOf(
      account.id,
      db.rooms,
      db.participants,
      (id) => db.statements.find((s) => s.id === id)?.title ?? null,
      (id) => db.simulations.find((s) => s.id === id),
      toLocalDateTime(new Date()),
    ));
  }
  const roomMatch = /^\/exam-rooms\/(\d+)\/(join|student)$/.exec(pathname);
  if (roomMatch) {
    const roomId = Number(roomMatch[1]);
    const now = toLocalDateTime(new Date());
    if (roomMatch[2] === 'join' && method === 'POST') {
      const joined = join(roomId, account.id, db.rooms, db.participants, now, (room) => {
        const row: SimulationRow = {
          id: db.nextSimulation++, accountId: account.id, statementId: room.statementId, status: 'IN_PROGRESS',
          finalScore: null, startedAt: now, finishedAt: null, timeSpentSeconds: null, examRoomId: room.id,
        };
        db.simulations.push(row);
        return row.id;
      });
      return joined.ok ? json(joined.body) : problem(joined.problem.status, joined.problem.detail);
    }
    if (roomMatch[2] === 'student' && method === 'GET') {
      const view = studentView(roomId, account.id, db.rooms, db.participants, now, (statementId) =>
        (QUESTIONS_BY_STATEMENT[statementId] ?? [])
          .map((qid) => db.questions.find((q) => q.id === qid))
          .filter((q): q is MockQuestion => q !== undefined)
          // Sem gabarito: a vista do aluno nunca leva o `isCorrect`.
          .map((q) => ({ ...q, options: q.options.map(({ isCorrect: _hidden, ...o }) => o) })),
      );
      return view.ok ? json(view.body) : problem(view.problem.status, view.problem.detail);
    }
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

  // ── o tutor (BE-18 e BE-19) ───────────────────────────────────────────────────
  // POST /chat/sessions abre uma sessão presa a um enunciado que o aluno pode ler;
  // POST /chat/sessions/{id}/messages responde em text/event-stream: `delta`s, depois
  // `final`. Tudo o que falha ANTES do primeiro byte é um estado HTTP normal (404 de uma
  // sessão alheia, 429 + Retry-After, 503); depois só há um evento `error` na própria
  // stream. O texto da mensagem escolhe o caso, para o fluxo de integração os exercitar.
  if (pathname === '/chat/sessions' && method === 'POST') {
    const statementId = Number(body.statementId);
    if (!Number.isInteger(statementId) || statementId <= 0) {
      return validationError({ statementId: 'statementId is required' });
    }
    const statement = db.statements.find((x) => x.id === statementId);
    if (!statement || (!staff && !statement.visible)) return problem(404, 'Statement not found');
    const rawMode = body.mode ?? null;
    const allowedModes = ['GENERAL', 'EXPLAIN_QUESTION', 'SIMILAR_EXERCISES', 'CONCEPT'];
    if (rawMode !== null && !allowedModes.includes(String(rawMode))) {
      return validationError({ mode: 'mode must be a known tutor mode' });
    }
    const mode = (rawMode === null ? 'GENERAL' : String(rawMode)) as 'GENERAL' | 'EXPLAIN_QUESTION' | 'SIMILAR_EXERCISES' | 'CONCEPT';
    const rawQuestionId = body.questionId ?? null;
    if (rawQuestionId !== null && (!Number.isInteger(Number(rawQuestionId)) || Number(rawQuestionId) <= 0)) {
      return validationError({ questionId: 'questionId must be positive' });
    }
    const questionId = rawQuestionId === null ? null : Number(rawQuestionId);
    if ((mode === 'EXPLAIN_QUESTION' || mode === 'SIMILAR_EXERCISES') && questionId === null) {
      return validationError({ questionId: 'questionId is required for this mode' });
    }
    const askedQuestion =
      questionId === null
        ? null
        : db.questions.find((q) => q.id === questionId && (QUESTIONS_BY_STATEMENT[statementId] ?? []).includes(q.id)) ?? null;
    if (questionId !== null && !askedQuestion) return problem(404, 'Question is not part of this statement.');
    const rawSelectedOptionId = body.selectedOptionId ?? null;
    if (rawSelectedOptionId !== null && (!Number.isInteger(Number(rawSelectedOptionId)) || Number(rawSelectedOptionId) <= 0)) {
      return validationError({ selectedOptionId: 'selectedOptionId must be positive' });
    }
    const selectedOptionId = rawSelectedOptionId === null ? null : Number(rawSelectedOptionId);
    const studentAnswer = body.studentAnswer === undefined || body.studentAnswer === null ? null : String(body.studentAnswer);
    if (studentAnswer !== null && studentAnswer.length > 2000) {
      return validationError({ studentAnswer: 'studentAnswer must be at most 2000 characters' });
    }
    if ((selectedOptionId !== null || studentAnswer !== null) && questionId === null) {
      return validationError({ questionId: 'questionId is required when an answer is provided' });
    }
    const session = {
      id: db.chatSessions.length + 1,
      accountId: account.id,
      statementId,
      mode,
      questionId,
      selectedOptionId,
      studentAnswer,
    };
    db.chatSessions.push(session);
    return json({ id: session.id, statementId, mode, questionId, sources: tutorSources(statement, askedQuestion, mode), createdAt: toLocalDateTime(new Date()) }, 201);
  }

  const chatMatch = /^\/chat\/sessions\/(\d+)\/messages$/.exec(pathname);
  if (chatMatch && method === 'POST') {
    const session = db.chatSessions.find((x) => x.id === Number(chatMatch[1]) && x.accountId === account.id);
    // Uma sessão alheia é 404, não 403: não se revela que existe.
    if (!session) return problem(404, 'Chat session not found');
    const content = text('content');
    if (!content) return validationError({ content: 'content is required' });
    if (content.length > 4000) return validationError({ content: 'content must be at most 4000 characters' });
    if (content.includes('[[sem-chave]]')) return problem(503, 'The AI provider is not configured');
    const extra = Object.keys(body).filter((key) => key !== 'content');
    if (extra.length > 0) return validationError({ content: 'message endpoint only accepts content' });

    db.chatSent[account.id] = (db.chatSent[account.id] ?? 0) + 1;
    if (content.includes('[[limite]]') || db.chatSent[account.id] > 30) {
      return new Response(
        JSON.stringify({ type: null, title: 'Too Many Requests', status: 429, detail: 'Too many tutor messages. Try again later.', properties: { code: 'CHAT_RATE_LIMITED' } }),
        { status: 429, headers: { 'Content-Type': 'application/problem+json', 'Retry-After': '90' } },
      );
    }

    const statement = db.statements.find((x) => x.id === session.statementId);
    const askedQuestion =
      session.questionId == null
        ? null
        : db.questions.find((q) => q.id === session.questionId && (QUESTIONS_BY_STATEMENT[session.statementId] ?? []).includes(q.id)) ?? null;
    const reply = content.includes('[[fora]]')
      ? 'Só acompanho o enunciado desta sessão, por isso não consigo ajudar com esse assunto.'
      : `Vamos por passos, sobre «${statement?.title ?? 'esta prova'}». Primeiro, identifica o que a questão pede. Depois, aplica a regra e confirma o resultado: a escolha final é tua.`;
    const pieces = reply.match(/\S+\s*/g) ?? [reply];
    const broken = content.includes('[[erro]]');
    const encoder = new TextEncoder();
    const sse = (type: string, payload: object) =>
      encoder.encode(`event: ${type}\ndata: ${JSON.stringify({ type, ...payload })}\n\n`);

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        for (const [i, piece] of pieces.entries()) {
          if (broken && i === 3) {
            controller.enqueue(sse('error', { code: 'CHAT_PROVIDER_TIMEOUT', message: 'Provider timed out' }));
            controller.close();
            return;
          }
          controller.enqueue(sse('delta', { content: piece }));
          await new Promise((resolve) => setTimeout(resolve, 15));
        }
        controller.enqueue(sse('final', {
          messageId: db.chatSent[account.id],
          model: 'mock',
          sources: tutorSources(statement, askedQuestion, session.mode),
        }));
        controller.close();
      },
    });
    return new Response(stream, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
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
