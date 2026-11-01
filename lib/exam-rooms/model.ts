import { toLuandaDateTimeLocal } from '../format.ts';

// Salas de Prova (FE-13): os contratos do backend e as regras que o ecrã usa.
//
// Os DTOs são os do `examrooms` do backend (BE-16 e BE-17). As horas chegam como
// `LocalDateTime` sem fuso, na hora do servidor, que corre em Africa/Luanda
// (`TZ` no backend.Dockerfile). Por isso aqui nunca se constrói um `Date` a partir
// de texto: as horas são tratadas como hora de parede, lidas e escritas como texto.
// Um `new Date('2026-10-12T09:00:00')` dependia do fuso do browser e deslocava a
// janela da prova para quem não estivesse em Luanda. Para subtrair, `Date.UTC`
// trata os campos como número, sem fuso.

export type RoomStatus = 'DRAFT' | 'OPEN' | 'RUNNING' | 'CLOSED';

/** `ExamRoomResponse` */
export interface ExamRoom {
  id: number;
  statementId: number;
  classId: number | null;
  teacherAccountId: number;
  startsAt: string;
  endsAt: string;
  durationMinutes: number;
  status: RoomStatus;
}

/** `ExamRoomLiveResponse.ParticipantProgress` */
export interface ParticipantProgress {
  accountId: number;
  simulationId: number | null;
  joinedAt: string | null;
  /** `NOT_STARTED` ou o estado da simulação (`IN_PROGRESS`, `FINISHED`…). */
  status: string;
  answeredQuestions: number;
  totalQuestions: number;
  /** Ainda não vem do backend; ver `participantName`. */
  displayName?: string | null;
}

/** `ExamRoomLiveResponse` */
export interface LiveSnapshot {
  roomId: number;
  status: RoomStatus;
  serverTime: string;
  startsAt: string;
  endsAt: string;
  remainingSeconds: number;
  totalParticipants: number;
  joinedParticipants: number;
  submittedParticipants: number;
  progressPercentage: number;
  participants: ParticipantProgress[];
}

/** `ExamRoomGradeResponse` */
export interface Grade {
  accountId: number;
  simulationId: number | null;
  status: string | null;
  finalScore: number | null;
  correctAnswers: number | null;
  totalQuestions: number | null;
  pendingReviewCount: number | null;
  finishedAt: string | null;
  displayName?: string | null;
}

export const STATUS_LABEL: Record<RoomStatus, string> = {
  DRAFT: 'Rascunho',
  OPEN: 'Aberta',
  RUNNING: 'A decorrer',
  CLOSED: 'Encerrada',
};

export const PARTICIPANT_LABEL: Record<string, string> = {
  NOT_STARTED: 'Por entrar',
  IN_PROGRESS: 'A responder',
  FINISHED: 'Entregou',
  EXPIRED: 'Tempo esgotado',
  CANCELLED: 'Cancelada',
};

// ── modo de avaliação (#192) ────────────────────────────────────────────────

/**
 * `IntegrityEventResponse`: um evento que o modo de avaliação registou, com a hora
 * que o SERVIDOR lhe deu — o cliente nunca a manda.
 *
 * Os nomes dos eventos têm de bater certo com `student/lib/integrity.ts`, de onde
 * nascem, e com o contrato do backend. Há um teste de cada lado a fixá-los, como
 * nas denúncias (#323), porque um evento que o aluno escreve e o professor não sabe
 * ler é pior do que não o ter.
 */
export interface IntegrityEvent {
  id: number;
  kind: string;
  at: string;
  questionId: number | null;
}

/** `RoomIntegrityResponse.ParticipantIntegrity` */
export interface ParticipantIntegrity {
  accountId: number;
  simulationId: number | null;
  events: IntegrityEvent[];
  /** Ainda não vem do backend; ver `participantName`. */
  displayName?: string | null;
}

/** `RoomIntegrityResponse` */
export interface RoomIntegrity {
  roomId: number;
  serverTime: string;
  participants: ParticipantIntegrity[];
}

export const INTEGRITY_LABEL: Record<string, string> = {
  TAB_HIDDEN: 'Saiu do separador',
  TAB_VISIBLE: 'Voltou ao separador',
  WINDOW_BLUR: 'Perdeu o foco da janela',
  WINDOW_FOCUS: 'Recuperou o foco da janela',
  PASTE_BLOCKED: 'Tentou colar uma resposta',
  TUTOR_BLOCKED: 'Tentou abrir o tutor durante a prova',
};

/** Os eventos que, para o professor, contam como o aluno ter saído da prova: os
 *  pares `TAB_VISIBLE`/`WINDOW_FOCUS` são o regresso e não somam.
 *
 *  Esconder o separador e perder o foco são a MESMA saída vista por dois sinais do
 *  browser. O cliente já os engole juntos (`student/lib/integrity.ts`), mas o
 *  servidor pode guardá-los separados — dois pedidos que chegam fora da janela do
 *  cliente. Por isso a deduplicação é feita também aqui, na leitura. */
const INTEGRITY_EXIT = new Set(['TAB_HIDDEN', 'WINDOW_BLUR']);

/** A janela em que dois sinais são a mesma saída. Tem de ser a mesma do cliente
 *  (`student/lib/integrity.ts`, `COALESCE_MS`): mudar uma sem a outra faz o
 *  professor ler um número que o aluno não produziu. */
export const INTEGRITY_COALESCE_MS = 2_000;

export interface IntegritySummary {
  total: number;
  /** Saídas da prova (separador escondido ou janela sem foco), sem contar duas
   *  vezes os dois sinais da mesma saída. */
  exits: number;
  /** Quantos eventos de cada tipo, na ordem em que apareceram. É a contagem crua:
   *  dois sinais contam dois aqui, mas uma só saída em `exits`. */
  byKind: { kind: string; label: string; count: number }[];
}

export function summarizeIntegrity(events: IntegrityEvent[]): IntegritySummary {
  const counts = new Map<string, number>();
  for (const e of events) counts.set(e.kind, (counts.get(e.kind) ?? 0) + 1);

  // Pela hora, não pela ordem de chegada: o servidor pode devolver os eventos
  // fora de ordem, e a janela é sobre quando aconteceram.
  const ordered = [...events].sort((a, b) => (wallSeconds(a.at) ?? 0) - (wallSeconds(b.at) ?? 0));
  let exits = 0;
  let lastExit: number | null = null;
  for (const e of ordered) {
    if (!INTEGRITY_EXIT.has(e.kind)) continue;
    const at = wallSeconds(e.at);
    if (lastExit !== null && at !== null && at - lastExit < INTEGRITY_COALESCE_MS / 1000) continue;
    exits += 1;
    if (at !== null) lastExit = at;
  }

  return {
    total: events.length,
    exits,
    byKind: [...counts.entries()].map(([kind, count]) => ({ kind, label: INTEGRITY_LABEL[kind] ?? kind, count })),
  };
}

/** O backend ainda não devolve o nome do aluno (pedido no kixi#181). Até lá,
 *  o número da conta é a única identificação que o professor pode ler. */
export function participantName(p: { accountId: number; displayName?: string | null }): string {
  return p.displayName?.trim() || `Aluno n.º ${p.accountId}`;
}

// ── hora de parede ──────────────────────────────────────────────────────────

const WALL = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/;

/** Minutos desde 1970 de uma hora de parede, para comparar e subtrair sem fuso. */
export function wallMinutes(value: string): number | null {
  const m = WALL.exec(value);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m.map(Number);
  return Date.UTC(y, mo - 1, d, h, mi) / 60_000;
}

/** Segundos desde 1970 de uma hora de parede — como `wallMinutes`, com a precisão
 *  que os eventos precisam (dois sinais da mesma saída chegam no mesmo segundo).
 *  `Date.UTC` fixa a hora de parede; não lê o fuso do browser. */
function wallSeconds(value: string): number | null {
  const m = WALL.exec(value);
  if (!m) return null;
  const [, y, mo, d, h, mi, s] = m;
  return Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), s ? Number(s) : 0) / 1000;
}

/** "12/10 09:00", ou com o ano quando não é o corrente. */
export function formatWall(value: string | null | undefined, currentYear?: number): string {
  if (!value) return '—';
  const m = WALL.exec(value);
  if (!m) return value;
  const [, y, mo, d, h, mi] = m;
  const year = currentYear && Number(y) !== currentYear ? `/${y}` : '';
  return `${d}/${mo}${year} ${h}:${mi}`;
}

/** O valor de um `<input type="datetime-local">` como o `LocalDateTime` que o backend espera. */
export function toLocalDateTime(input: string): string {
  return input.length === 16 ? `${input}:00` : input;
}

/** A hora de parede de Luanda agora (UTC+1, sem horário de verão), no formato do input. */
export function luandaNowInput(now: Date = new Date()): string {
  return toLuandaDateTimeLocal(now);
}

/** `mm:ss`, ou `h:mm:ss` a partir de uma hora. */
export function formatCountdown(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

// ── nova sala ───────────────────────────────────────────────────────────────

export interface RoomDraft {
  classId: string;
  statementId: string;
  startsAt: string;
  endsAt: string;
  durationMinutes: string;
}

/** O que impede a criação, na ordem em que o professor preenche. O backend
 *  valida o mesmo; isto evita a viagem e diz a frase em português. */
export function draftProblem(d: RoomDraft): string | null {
  if (!d.classId) return 'Escolha a turma.';
  if (!d.statementId) return 'Escolha o enunciado.';
  const start = wallMinutes(d.startsAt);
  const end = wallMinutes(d.endsAt);
  if (start === null) return 'Indique quando a sala abre.';
  if (end === null) return 'Indique quando a sala fecha.';
  if (end <= start) return 'A sala tem de fechar depois de abrir.';
  const duration = Number(d.durationMinutes);
  if (!Number.isInteger(duration) || duration <= 0) return 'A duração tem de ser um número inteiro de minutos.';
  if (duration > end - start) return `A duração (${duration} min) não cabe na janela da sala (${end - start} min).`;
  return null;
}

/**
 * Os enunciados que podem ir para uma sala desta turma. O backend
 * (`ExamRoomService.create`) exige que a turma do enunciado seja a da sala, e
 * recusa ao professor um enunciado sem turma; o ADMIN pode usar os sem turma.
 */
export function statementFitsRoom(
  statement: { classId?: unknown },
  classId: number,
  admin: boolean,
): boolean {
  const own = statement.classId === null || statement.classId === undefined || statement.classId === ''
    ? null
    : Number(statement.classId);
  if (own === null) return admin;
  return own === classId;
}

/**
 * A turma e o enunciado com que o assistente de salas abre quando vem de um enunciado
 * (`/exam-rooms/new?statementId=…`): o professor acabou de guardar ou ver uma prova e quer dá-la.
 *
 * A turma é a do enunciado, porque a sala só aceita o enunciado da mesma turma. Um enunciado sem turma
 * (só o ADMIN o pode usar) deixa a turma por escolher, ou escolhe-a quando há uma só. Devolve `null` quando
 * o enunciado não está entre os que este utilizador pode usar (outra escola, ou já não existe): então o
 * assistente abre vazio, como sempre abriu, em vez de fingir que o escolheu.
 */
export function preselectFromStatement(
  statements: readonly { id: number; classId: number | null; durationMinutes: number | null }[],
  classes: readonly { id: number }[],
  statementId: string | null | undefined,
  admin: boolean,
): { classId: string; statementId: string; durationMinutes: number | null } | null {
  if (!statementId || !/^\d+$/.test(statementId)) return null;
  const st = statements.find((x) => String(x.id) === statementId);
  if (!st) return null;
  const classId = st.classId ?? (classes.length === 1 ? classes[0].id : null);
  if (classId === null) return { classId: '', statementId: '', durationMinutes: null };
  if (!classes.some((c) => c.id === classId)) return null;
  if (!statementFitsRoom(st, classId, admin)) return null;
  return { classId: String(classId), statementId: String(st.id), durationMinutes: st.durationMinutes && st.durationMinutes > 0 ? st.durationMinutes : null };
}

// ── controlo da sala ────────────────────────────────────────────────────────

export type RoomAction = 'open' | 'start' | 'close';

/**
 * As transições que o `ExamRoomService.transition` aceita agora, com o motivo
 * quando não aceita. `now` é a hora de parede de Luanda.
 */
export function roomActions(
  room: Pick<ExamRoom, 'status' | 'startsAt' | 'endsAt'>,
  now: string,
): Record<RoomAction, { allowed: boolean; reason: string | null }> {
  const t = wallMinutes(now) ?? 0;
  const start = wallMinutes(room.startsAt) ?? 0;
  const end = wallMinutes(room.endsAt) ?? 0;
  const ended = t >= end;
  const s = room.status;
  return {
    open:
      s !== 'DRAFT'
        ? { allowed: false, reason: null }
        : ended
          ? { allowed: false, reason: 'A janela da sala já terminou.' }
          : { allowed: true, reason: null },
    start:
      s !== 'OPEN'
        ? { allowed: false, reason: s === 'DRAFT' ? 'Abra a sala primeiro.' : null }
        : t < start
          ? { allowed: false, reason: `Só pode iniciar a partir de ${formatWall(room.startsAt)}.` }
          : ended
            ? { allowed: false, reason: 'A janela da sala já terminou.' }
            : { allowed: true, reason: null },
    close: { allowed: s === 'OPEN' || s === 'RUNNING', reason: null },
  };
}

// ── resultados ──────────────────────────────────────────────────────────────

export interface GradeSummary {
  invited: number;
  graded: number;
  pendingReview: number;
  average: number | null;
  min: number | null;
  max: number | null;
  /** % de notas iguais ou acima de metade da cotação total, entre as que existem. */
  passRate: number | null;
  /** Contagem por intervalo de 2 valores (0–2, 2–4, …), numa prova de 20. */
  buckets: { label: string; count: number }[];
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export function summarizeGrades(grades: Grade[], totalMaxScore = 20): GradeSummary {
  const scores = grades.map((g) => g.finalScore).filter((s): s is number => typeof s === 'number' && Number.isFinite(s));
  const max = totalMaxScore > 0 ? totalMaxScore : 20;
  const width = max / 10;
  const buckets = Array.from({ length: 10 }, (_, i) => ({
    label: `${round1(i * width)}–${round1((i + 1) * width)}`,
    count: 0,
  }));
  for (const s of scores) buckets[Math.min(9, Math.max(0, Math.floor(s / width)))].count += 1;
  return {
    invited: grades.length,
    graded: scores.length,
    pendingReview: grades.reduce((n, g) => n + (g.pendingReviewCount && g.pendingReviewCount > 0 ? 1 : 0), 0),
    average: scores.length ? round1(scores.reduce((a, b) => a + b, 0) / scores.length) : null,
    min: scores.length ? Math.min(...scores) : null,
    max: scores.length ? Math.max(...scores) : null,
    passRate: scores.length ? round1((scores.filter((s) => s >= max / 2).length / scores.length) * 100) : null,
    buckets,
  };
}

const csvCell = (v: unknown) => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/**
 * As notas em CSV para abrir no Excel: separador `;` e vírgula decimal, como o
 * Excel em português espera, e BOM para os acentos chegarem inteiros.
 */
export function gradesCsv(grades: Grade[]): string {
  const decimal = (n: number | null) => (n === null || n === undefined ? '' : String(n).replace('.', ','));
  const rows = [
    ['Aluno', 'Conta', 'Estado', 'Nota', 'Respostas certas', 'Questões', 'Por corrigir', 'Entregue em'],
    ...grades.map((g) => [
      participantName(g),
      g.accountId,
      g.status ? (PARTICIPANT_LABEL[g.status] ?? g.status) : '',
      decimal(g.finalScore),
      g.correctAnswers ?? '',
      g.totalQuestions ?? '',
      g.pendingReviewCount ?? '',
      g.finishedAt ? formatWall(g.finishedAt) : '',
    ]),
  ];
  return `\uFEFF${rows.map((r) => r.map(csvCell).join(';')).join('\r\n')}\r\n`;
}

/** A resposta aberta de um aluno, como `GET /exam-rooms/{id}/review` a devolve. */
export interface ReviewAnswer {
  answerId: number;
  accountId: number;
  displayName: string | null;
  answerText: string | null;
  /** `AI_GRADED`: corrigida pela IA no fluxo do motor (provas de um plano do trimestre), só para leitura. */
  status: 'PENDING_REVIEW' | 'GRADED' | 'AI_GRADED';
  scoreObtained: number | null;
  /** Só nas respostas corrigidas pela IA. */
  aiFeedback?: string | null;
  aiLevel?: 'TOTAL' | 'PARCIAL' | 'MINIMA' | 'NULA' | null;
  aiConfidence?: number | null;
}

/** Uma questão aberta da sala, com a chave (resposta modelo) e as respostas dos alunos. */
export interface ReviewQuestion {
  questionId: number;
  number: number | null;
  label: string | null;
  parentId: number | null;
  text: string;
  maxScore: number | null;
  modelAnswer: string | null;
  answers: ReviewAnswer[];
}

export interface RoomReview {
  questions: ReviewQuestion[];
  pending: number;
  graded: number;
  /** Respostas corrigidas pela IA (salas de um plano). */
  aiGraded?: number;
  /** A sala é de uma avaliação de um plano do trimestre: a correção é da IA no fluxo e o professor só lê. */
  planLinked?: boolean;
}

export const AI_LEVEL_LABEL: Record<string, string> = {
  TOTAL: 'Resposta completa',
  PARCIAL: 'Resposta parcial',
  MINIMA: 'Resposta mínima',
  NULA: 'Sem pontuação',
};

/** O que o professor lê numa resposta de uma sala de plano: corrigida pela IA, ou ainda à espera dela. */
export function aiStateLabel(answer: Pick<ReviewAnswer, 'status'>): string {
  return answer.status === 'PENDING_REVIEW' ? 'A aguardar correção automática' : 'Corrigida pela IA';
}

export interface BulkGradeResult {
  graded: number;
  byKey: number;
  failed: { answerId: number; message: string }[];
}

/** O que o professor escreveu: texto por resposta (vírgula decimal aceite). */
export type ScoreDrafts = Record<number, string>;

/** Converte o que se escreveu numa nota; `null` se estiver vazio ou for inválido ou acima da cotação. */
export function parseScore(raw: string | undefined, max: number | null): number | null {
  if (raw == null || raw.trim() === '') return null;
  const value = Number(raw.replace(',', '.'));
  if (!Number.isFinite(value) || value < 0) return null;
  if (max != null && value > max) return null;
  return value;
}

/** As notas a enviar: só as respostas por corrigir com uma nota válida escrita. */
export function gradesToSend(review: RoomReview, drafts: ScoreDrafts): { answerId: number; score: number }[] {
  const out: { answerId: number; score: number }[] = [];
  for (const q of review.questions) {
    for (const a of q.answers) {
      if (a.status !== 'PENDING_REVIEW') continue;
      const score = parseScore(drafts[a.answerId], q.maxScore);
      if (score !== null) out.push({ answerId: a.answerId, score });
    }
  }
  return out;
}

/** Respostas escritas que não valem: texto que não é número, negativo ou acima da cotação da questão. */
export function invalidDrafts(review: RoomReview, drafts: ScoreDrafts): number[] {
  const bad: number[] = [];
  for (const q of review.questions) {
    for (const a of q.answers) {
      const raw = drafts[a.answerId];
      if (a.status === 'PENDING_REVIEW' && raw != null && raw.trim() !== '' && parseScore(raw, q.maxScore) === null) bad.push(a.answerId);
    }
  }
  return bad;
}

/**
 * Igual à normalização do backend (`ExamRoomCorrectionService.normalize`): sem acentos,
 * maiúsculas, pontuação nem espaços a mais. A pré-visualização tem de contar o mesmo que o servidor.
 */
export function normalizeAnswer(value: string | null | undefined): string {
  if (!value) return '';
  return value.normalize('NFD').replace(/\p{M}+/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

/** Em branco nunca coincide, tal como no backend. */
export function matchesKey(answer: string | null | undefined, key: string | null | undefined): boolean {
  const a = normalizeAnswer(answer);
  return a !== '' && a === normalizeAnswer(key);
}

/**
 * Quantas respostas «Corrigir pela chave» vai corrigir: as por corrigir, de questões com cotação,
 * que coincidem com a chave e a que o professor não escreveu já uma nota (a nota à mão vence).
 */
export function keyMatchCount(review: RoomReview, drafts: ScoreDrafts): number {
  let count = 0;
  for (const q of review.questions) {
    if (q.maxScore === null) continue;
    for (const a of q.answers) {
      if (a.status !== 'PENDING_REVIEW') continue;
      if (parseScore(drafts[a.answerId], q.maxScore) !== null) continue;
      if (matchesKey(a.answerText, q.modelAnswer)) count++;
    }
  }
  return count;
}

export type ParticipantFilter = 'todos' | 'a-responder' | 'na-espera' | 'por-entrar' | 'entregaram';

export const PARTICIPANT_FILTERS: { value: ParticipantFilter; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'a-responder', label: 'A responder' },
  { value: 'na-espera', label: 'Na sala de espera' },
  { value: 'por-entrar', label: 'Ainda não entraram' },
  { value: 'entregaram', label: 'Entregaram' },
];

/**
 * `NOT_STARTED` com hora de entrada é a sala de espera (já entrou, só falta a prova começar); sem ela, ainda não
 * entrou. `EXPIRED` (tempo esgotado) conta como entregue: a prova foi submetida. Cada aluno cai em exatamente um
 * filtro além de «Todos», salvo estados que o gestor não conhece.
 */
export function participantMatches(p: Pick<ParticipantProgress, 'status' | 'joinedAt'>, filter: ParticipantFilter): boolean {
  if (filter === 'a-responder') return p.status === 'IN_PROGRESS';
  if (filter === 'na-espera') return p.status === 'NOT_STARTED' && !!p.joinedAt;
  if (filter === 'por-entrar') return p.status === 'NOT_STARTED' && !p.joinedAt;
  if (filter === 'entregaram') return p.status === 'FINISHED' || p.status === 'EXPIRED';
  return true;
}

export function participantCounts(participants: Pick<ParticipantProgress, 'status' | 'joinedAt'>[]): Record<ParticipantFilter, number> {
  const count = (filter: ParticipantFilter) => participants.filter((p) => participantMatches(p, filter)).length;
  return {
    todos: participants.length,
    'a-responder': count('a-responder'),
    'na-espera': count('na-espera'),
    'por-entrar': count('por-entrar'),
    entregaram: count('entregaram'),
  };
}

/** O que o diálogo de encerrar diz: quantos ainda respondem e quantos nem entraram, em vez de um aviso genérico. */
export function closeSummary(counts: Record<ParticipantFilter, number> | null): { title: string; description: string } {
  const tail = 'As notas ficam lançadas. Não dá para reabrir.';
  if (!counts) {
    return { title: 'Encerrar a sala?', description: `Quem ainda estiver a responder é submetido automaticamente com o que respondeu. ${tail}` };
  }
  const answering = counts['a-responder'];
  const waiting = counts['na-espera'];
  const notIn = counts['por-entrar'];
  const parts: string[] = [];
  if (answering > 0) {
    parts.push(
      answering === 1
        ? '1 aluno ainda está a responder e será submetido automaticamente com o que respondeu.'
        : `${answering} alunos ainda estão a responder e serão submetidos automaticamente com o que responderam.`,
    );
  } else {
    parts.push('Ninguém está a responder neste momento.');
  }
  if (waiting > 0) parts.push(waiting === 1 ? '1 aluno está na sala de espera.' : `${waiting} alunos estão na sala de espera.`);
  if (notIn > 0) parts.push(notIn === 1 ? '1 aluno ainda não entrou.' : `${notIn} alunos ainda não entraram.`);
  parts.push(tail);
  return { title: answering > 0 ? `Encerrar a sala? ${answering} ainda a responder` : 'Encerrar a sala?', description: parts.join(' ') };
}
