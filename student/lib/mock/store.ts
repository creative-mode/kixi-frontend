import 'server-only';
import { countLeafQuestions } from './leaf-count';
import { resolveSchoolId } from './school';
import * as friends from './friends';
import { effectiveFault, normalizeFault, type Fault } from './fault';
import { deadlineFor, expired, finalScore, gradeAnswer, toLocalDateTime, type MockAnswer, type MockQuestion } from './simulation';
import crypto from 'node:crypto';
import { getJwtSecretValue, isMockEnabled } from '../dev-secret';
import { roomDeadline, type MockParticipant, type MockRoom } from './exam-rooms';
import { type MockPostComment } from './feed-comments';
import { type PostBlock } from '../post-blocks';
import { parseServerTime } from '../exam-rules';
import { type EnrollmentCode } from './enrollment-codes';
import type { Course, Enrollment, Institution, Me, SchoolYear } from '@/lib/types';

/** In-process stand-in for the Spring Boot backend: the aluno app needs no server
 *  while we design. Same contracts as the real API — DTO shapes (including the
 *  snake_case annotations), soft delete, RFC 9457 errors, HS256 JWT — and the same
 *  security rules, so the screens can be built against it without a database.
 *  The secret matches the manager's, so the same cookie works on both apps.
 *  Set KIXI_MOCK=false to talk to the real API instead. */
export const MOCK = isMockEnabled();

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

export const SEED_PASSWORD = 'Kixi1234!';
export const TOKEN_TTL = 86400;

export type Account = {
  id: number;
  username: string;
  email: string;
  passwordHash: string;
  roles: string[];
  active: boolean;
  firstName: string;
  lastName: string;
  photo: string | null;
  /** Oculta ou suspensa por decisao de moderacao (#323). Ocultado devolve 404 a
   *  terceiros; suspenso devolve 404 e deixa de permitir entrar. */
  hidden?: boolean;
  suspended?: boolean;
  /** Read-only from the student's side; the backend has already folded it into the
   *  simulation's `deadline`, so the mock mirrors that rather than recomputing it. */
  accessibilityExtraTime: boolean;
};
/** How a class is stored, as opposed to how ClassResponse exposes it: the rows keep
 *  the foreign keys and the response resolves them into nested objects. */
export type ClassRow = {
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
export type CatalogRow = {
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

export type SimulationRow = {
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

export type Store = {
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
  /** Códigos de matrícula (kixi#255): a auto-matrícula troca um destes, a
   *  do admin/professor por outra conta continua a dispensar código. */
  enrollmentCodes: EnrollmentCode[];
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
  /** Denúncias de perfil e de escola (#323). As de publicação eram descartadas: o
   *  endpoint existia, respondia 201, e não guardava nada. */
  reports: MockReport[];
  nextReport: number;
  /** Bloqueios de pessoa (#323). Guardados como par normalizado: `blockPair` garante
   *  que o mesmo bloqueio nunca existe nos dois sentidos. */
  blocks: { accountId: number; blockedAccountId: number; createdAt: string }[];
  /** Eventos do modo de avaliação (#192): o que o aluno fez e o servidor viu. A hora
   *  é carimbada no servidor, nunca a que o cliente mande. */
  integrityEvents: MockIntegrityEvent[];
  nextIntegrityEvent: number;
};

export type MockIntegrityEvent = {
  id: number;
  simulationId: number;
  kind: string;
  questionId: number | null;
  at: string;
};

export type MockReport = {
  id: number;
  target: 'ACCOUNT' | 'INSTITUTION';
  targetId: number;
  reporterAccountId: number;
  reason: string;
  note: string;
  createdAt: string;
};

export type MockSolutionShare = {
  id: number;
  simulationId: number;
  anonymous: boolean;
  displayName: string | null;
  consentAt: string;
};

export type MockPost = {
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

export type MockUserStats = {
  accountId: number;
  xp: number;
  level: number;
  streak: number;
  longestStreak: number;
  freePauses: number;
  lastActivityDate: string | null;
};

export type MockUserBadge = {
  code: string;
  name: string;
  description: string;
  subjectId: number | null;
  unlockedAt: string;
};

export const G = globalThis as unknown as { __kixiStudentMock?: Store; __kixiFault?: Fault };

export const hash = (pw: string) => crypto.createHash('sha256').update(`kixi:${pw}`).digest('hex');
export const b64 = (v: object) => Buffer.from(JSON.stringify(v)).toString('base64url');

export function sign(payload: object): string {
  const head = b64({ alg: 'HS256', typ: 'JWT' });
  const body = b64(payload);
  const sig = crypto.createHmac('sha256', getJwtSecretValue()).update(`${head}.${body}`).digest('base64url');
  return `${head}.${body}.${sig}`;
}

/** Mirrors the backend's JwtService: signature and expiry are checked here, unlike
 *  the unverified read in lib/session.ts that only drives routing. */
export function accountIdOf(token: string | null): number | null {
  if (!token) return null;
  const [head, body, sig] = token.split('.');
  if (!head || !body || !sig) return null;
  const expected = crypto.createHmac('sha256', getJwtSecretValue()).update(`${head}.${body}`).digest('base64url');
  if (sig !== expected) return null;
  try {
    const claims = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (typeof claims.exp === 'number' && claims.exp * 1000 < Date.now()) return null;
    return Number(claims.sub) || null;
  } catch {
    return null;
  }
}

export function seed(): Store {
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
    // Ocultada por moderação (#323). Sem esta conta semeada, o critério de aceitação —
    // «perfil ocultado devolve 404 a terceiros» — não é demonstrável neste mock: os
    // dois mocks são processos separados, e uma decisão do Manager só chega ao mock
    // do aluno quando o backend real existir.
    hidden = false,
  ): Account => ({
    id,
    username,
    email,
    passwordHash: hash(SEED_PASSWORD),
    roles: [role],
    active: true,
    hidden,
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
    // Perfil ocultado por moderação, para o 404 a terceiros ter com que ser
    // demonstrado. Aparece no ranking e na busca — ocultar o perfil não apaga a
    // pessoa, tira-lhe o perfil.
    { ...account(7, 'perfil.oculto', 'oculto@kixi.ao', 'STUDENT', 'Perfil', 'Oculto'), hidden: true },
  ];

  return {
    accounts,
    // Derivado, não escrito à mão: semeei a conta 7 e o `nextAccount` ficou em 7, e a
    // primeira pessoa a registar-se recebeu o id de uma conta que já existia. O perfil
    // dela passou a mostrar «Perfil Oculto» — outra pessoa. Numa app de demonstração
    // isso é uma usurpação de identidade, que é o que a #323 vem impedir.
    nextAccount: Math.max(...accounts.map((a) => a.id)) + 1,
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
    // Códigos fixos e com usos de sobra: os testes de fluxo e o Playwright
    // auto-matriculam-se com eles, como se a escola os tivesse distribuído. O
    // TESTE5678 é da turma 5 (11A), a turma vazia que o fluxo usa para os estados
    // sem tentativas e o ranking 1.º de 1; o TESTE1234 é da 12B, com colegas.
    enrollmentCodes: [
      { id: 1, code: 'TESTE1234', classId: 1, maxUses: 9999, uses: 0, expiresAt: null, revokedAt: null },
      { id: 2, code: 'TESTE5678', classId: 5, maxUses: 9999, uses: 0, expiresAt: null, revokedAt: null },
    ],
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
        id: 2, number: 2, text: 'Quantos hosts utilizáveis tem uma sub-rede /29? Usa $2^h - 2$ para calcular o número de hosts.',
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
    reports: [],
    nextReport: 1,
    blocks: [],
    // Vazio: quem os cria é a sala de prova, ao correr (#192). Semeá-los não teria
    // quem os lesse — o professor lê os do mock do gestor, que é outro processo.
    integrityEvents: [],
    nextIntegrityEvent: 1,
  };
}

export function store(): Store {
  G.__kixiStudentMock ??= seed();
  return G.__kixiStudentMock;
}

/** RFC 9457 problem details, as produced by ApiException in the backend. */
export function problem(status: number, detail: string): Response {
  return Response.json({ type: null, title: null, status, detail, properties: null }, { status });
}

export function validationError(fields: Record<string, string>): Response {
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
export function unauthorized(): Response {
  return new Response(null, { status: 401 });
}

export const json = <T>(data: T, status = 200) => Response.json(data, { status });

export function loginResponse(account: Account) {
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

export const yearLabel = (year: SchoolYear) => `${year.startYear}/${year.endYear}`;

/** O nome mascarado de uma conta, como o ranking e a conversa o recebem (#179):
 *  primeiro nome e inicial do apelido. Sem perfil, sem nome. */
export function maskedName(db: Store, id: number): string | null {
  const account = db.accounts.find((x) => x.id === id);
  if (!account?.firstName || !account.lastName) return null;
  return `${account.firstName} ${account.lastName.charAt(0)}.`;
}

export function ownedBy(db: Store, simulationId: number, accountId: number): boolean {
  return db.simulations.some((s) => s.id === simulationId && s.accountId === accountId);
}

/** Which questions belong to which statement. The rows keep only what the pure
 *  grading rules need, so the link lives here rather than in simulation.ts. */
export const QUESTIONS_BY_STATEMENT: Record<number, number[]> = {
  1: [1, 2, 3, 4, 5],
  2: [1, 2, 3],
  // Três questões, para a sala de prova da semente ter o que responder.
  3: [1, 2, 4],
  // OGI: as folhas e, no meio, os enunciados comuns (que o aluno não responde).
  5: [101, 102, 103, 104, 105, 106, 107, 108],
};

/** StatementBasicResponse, as it nests inside SimulationResponse. */
export function statementBasic(row: SimulationRow, db: Store) {
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

export function statementSummary(db: Store, row: CatalogRow) {
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
export function roomDeadlineOf(db: Store, row: SimulationRow): string | null {
  if (!row.examRoomId || !row.startedAt) return null;
  const room = db.rooms.find((r) => r.id === row.examRoomId);
  return room ? roomDeadline(row.startedAt, room.durationMinutes, room.endsAt) : null;
}

export function simulationResponse(db: Store, row: SimulationRow) {
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
export function editableGuard(db: Store, simulationId: number, accountId: number): Response | null {
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
export function optionRefusal(db: Store, questionId: number, selectedOptionId: unknown): Response | null {
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
export function closeSimulation(db: Store, row: SimulationRow): void {
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

export function simulationResult(db: Store, row: SimulationRow) {
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
export function classResponse(db: Store, row: ClassRow) {
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

export function meResponse(db: Store, account: Account): Me {
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

export function tutorSources(
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

export type MockCtx = {
  method: string;
  pathname: string;
  search: URLSearchParams;
  filter: (key: string) => number | undefined;
  body: Record<string, unknown>;
  text: (key: string) => string;
  accountId: number;
  account: Account;
  staff: boolean;
  db: Store;
};
