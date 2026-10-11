import 'server-only';

import { apiGet, apiPost, apiPut, type Result } from './api';
import { getMe } from './me';
import {
  answeredQuestionIds,
  attemptFor,
  isChoice,
  orderQuestions,
  savedAnswerFor,
  type AnswerRequest,
  type ExamOption,
  type ExamQuestion,
  type SavedAnswer,
  type SimulationSummary,
} from './exam-rules';

/** The exam room's view of the backend (creative-mode/kixi, services/backend-api).
 *
 *  Unlike the profile DTOs, this whole area is camelCase: SimulationResponse,
 *  SimulationAnswerResponse and StatementOcrResponse carry no @JsonProperty, so
 *  there is nothing to fix here.
 *
 *  The fields the backend withholds from a STUDENT are optional rather than
 *  nullable, because `@JsonInclude(NON_NULL)` on the response records drops them
 *  from the JSON entirely (StatementOcrResponse.java:20, :117, :157). `isCorrect`
 *  is the answer key: for a student the field is not sent at all, so the room
 *  never reads it. */

export interface Simulation {
  id: number;
  account?: { id: number; username: string; email: string } | null;
  statement?: {
    id?: number | null;
    title?: string | null;
    examType?: string | null;
    durationMinutes?: number | null;
    totalMaxScore?: number | null;
  } | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  /** The instant the server stops accepting answers, with the +25% of extra time and
   *  the tolerance already applied (SimulationDeadlineService.java:89). Null when the
   *  simulation has no time limit, which is a real case and not an error. */
  deadline?: string | null;
  timeSpentSeconds?: number | null;
  finalScore?: number | null;
  status?: string | null;
}

export interface StatementFull {
  id: number;
  title?: string | null;
  examType?: string | null;
  durationMinutes?: number | null;
  instructions?: string | null;
  totalMaxScore?: number | null;
  subjectId?: number | null;
  schoolYearId?: number | null;
  institutionId?: number | null;
  questions: ExamQuestion[];
}

export interface QuestionImage {
  id: number;
  questionId: number;
  imageUrl: string;
  caption?: string | null;
  orderIndex?: number | null;
}

export interface SimulationResult {
  simulationId: number;
  status?: string | null;
  finalScore?: number | null;
  correctAnswers?: number | null;
  totalQuestions?: number | null;
  pendingReviewCount?: number | null;
  timeSpentSeconds?: number | null;
}

/** GET /simulations — the student's own attempts, IN_PROGRESS included
 *  (findByAccountIdAndDeletedAtIsNull carries no status filter). A failure here is
 *  not fatal on its own: the student can still start a first attempt, so this
 *  returns the list or an empty one. */
export async function listSimulations(): Promise<SimulationSummary[]> {
  const result = await apiGet<Simulation[]>('/simulations');
  if (!result.ok || !Array.isArray(result.data)) return [];
  return result.data;
}

/** Starts an attempt. The server starts the clock itself (SimulationService.java:95),
 *  so the body carries only the account and the statement: `startedAt` and `status`
 *  in the request are ignored, and sending them would be a claim the backend drops. */
export async function startSimulation(
  statementId: number,
  accountId: number,
): Promise<Result<Simulation>> {
  return apiPost<Simulation>('/simulations', { accountId, statementId });
}

/** The student variant of a statement is the same for every student and only changes
 *  when a teacher edits it, so each save does not need its own round trip for the
 *  whole statement just to learn one question's type. A short cache keeps the tap
 *  fast, which also narrows the window in which two saves can overlap. */
const FULL_TTL_MS = 60_000;
const fullCache = new Map<number, { at: number; data: StatementFull }>();

/** GET /statements/{id}/full — the questions. For a STUDENT the backend serves the
 *  visible variant with the answer key stripped (StatementController.java:132-136),
 *  and a statement that is not published is not readable at all. */
export async function getStatementFull(
  statementId: number,
  { cached = false }: { cached?: boolean } = {},
): Promise<Result<StatementFull>> {
  const hit = fullCache.get(statementId);
  if (cached && hit && Date.now() - hit.at < FULL_TTL_MS) return { ok: true, data: hit.data };

  const result = await apiGet<StatementFull>(`/statements/${statementId}/full`);
  if (!result.ok) {
    fullCache.delete(statementId);
    return result;
  }
  const data = { ...result.data, questions: orderQuestions(result.data.questions ?? []) };
  fullCache.set(statementId, { at: Date.now(), data });
  return { ok: true, data };
}

/** GET /simulation-answers — every active answer of the student, across attempts.
 *  There is no simulationId filter on the wire, so the rows of other attempts are
 *  dropped by `answeredQuestionIds` and `savedAnswerFor` before anything reads them. */
export async function listAnswers(): Promise<SavedAnswer[]> {
  const result = await apiGet<SavedAnswer[]>('/simulation-answers');
  return result.ok && Array.isArray(result.data) ? result.data : [];
}

/** Creates the answer the first time a question is touched, changes it afterwards.
 *  There is no upsert: a second POST for the same question is a 409
 *  (SimulationAnswerService.java:97), so `answerId` decides the verb.
 *
 *  If the POST still comes back 409 — a row the browser never heard about, because
 *  an earlier response was lost — the existing answer is looked up and the write is
 *  repeated as a PUT, so the value the student chose is the one the server ends up
 *  with instead of whichever request got there first. */
export async function saveAnswer(
  body: AnswerRequest,
  answerId: number | null,
): Promise<Result<SavedAnswer>> {
  if (answerId !== null) return apiPut<SavedAnswer>(`/simulation-answers/${answerId}`, body);

  const created = await apiPost<SavedAnswer>('/simulation-answers', body);
  if (created.ok || created.status !== 409) return created;

  const existing = savedAnswerFor(await listAnswers(), body.simulationId, body.questionId);
  if (!existing) return created;
  return apiPut<SavedAnswer>(`/simulation-answers/${existing.id}`, body);
}

/** POST /simulations/{id}/submit — the server grades what is stored and closes the
 *  simulation, so nothing is sent: a client-sent score would be ignored anyway
 *  (BE-09). Answering twice is a 409, which the room reads as "já entregue". */
export async function submitSimulation(simulationId: number): Promise<Result<SimulationResult>> {
  // O corpo vai vazio de propósito: a nota calcula-se no servidor, a partir do que
  // está guardado, e um score enviado pelo cliente seria ignorado (BE-09).
  return apiPost<SimulationResult>(`/simulations/${simulationId}/submit`, {});
}

/** GET /question-images/question/{questionId} — the images of one question. A
 *  question carries no image field of its own, so each one is a separate request;
 *  losing it costs an illustration, not the room, so this degrades to an empty list. */
export async function getQuestionImages(questionId: number): Promise<QuestionImage[]> {
  const result = await apiGet<QuestionImage[]>(`/question-images/question/${questionId}`);
  return result.ok && Array.isArray(result.data) ? result.data : [];
}

/** What the room needs to paint itself, in one pass.
 *
 *  The images are one request per question, which is the backend's shape and not a
 *  choice made here: questions have no image field, they have a `/question/{id}`
 *  route. They are fetched together rather than on navigation, so moving through
 *  the map never shows a question popping an image in after the fact. */
export interface RoomData {
  simulationId: number;
  /** `IN_PROGRESS` when the room is open. Carried through so the client can check
   *  the same condition the server does instead of assuming it is still writable. */
  status: string | null;
  /** Travels with every save: the action re-reads the questions, and the id it needs
   *  is the statement's, not the simulation's. */
  statementId: number;
  deadline: string | null;
  title: string;
  subtitle: string;
  questions: ExamQuestion[];
  images: Record<number, QuestionImage[]>;
  /** answerId per question, plus what to show in the form. A question absent from
   *  this map has never been answered, which is what tells POST from PUT. */
  saved: Record<number, { answerId: number; optionId: number | null; text: string }>;
  answered: number[];
}

export type Room =
  /** An attempt is in progress: this is the room. */
  | { kind: 'open'; data: RoomData }
  /** A previous attempt of this statement is already finished. The student goes to
   *  the result instead of silently starting a second attempt. */
  | { kind: 'finished'; simulationId: number }
  /** Nothing started yet: the page offers to start. */
  | { kind: 'new' }
  | { kind: 'unauthorized' }
  | { kind: 'error'; status: number; message: string };

export async function getRoom(statementId: number): Promise<Room> {
  const statement = await getStatementFull(statementId);
  // A distinção é a do lib/me.ts: 401 é o token, e tudo o que está a seguir
  // depende de haver sessão. Uma falha que não seja de sessão é mostrada como erro,
  // com a mensagem do servidor, e não mandada para o login.
  if (!statement.ok) {
    return statement.status === 401
      ? { kind: 'unauthorized' }
      : { kind: 'error', status: statement.status, message: statement.message };
  }

  const summary = attemptFor(await listSimulations(), statementId);
  if (!summary) return { kind: 'new' };
  if ((summary.status ?? '').toUpperCase() !== 'IN_PROGRESS') {
    return { kind: 'finished', simulationId: Number(summary.id) };
  }

  const simulationId = Number(summary.id);
  const [detail, answers] = await Promise.all([
    apiGet<Simulation>(`/simulations/${simulationId}`),
    listAnswers(),
  ]);
  if (!detail.ok) {
    return { kind: 'error', status: detail.status, message: detail.message };
  }

  const saved: RoomData['saved'] = {};
  for (const question of statement.data.questions) {
    const found = savedAnswerFor(answers, simulationId, question.id);
    if (!found) continue;
    saved[question.id] = {
      answerId: found.id,
      optionId: Number(found.selectedOptionId) || null,
      text: found.answerText ?? '',
    };
  }

  const questions = statement.data.questions;
  const images: RoomData['images'] = {};
  await Promise.all(
    questions.map(async (question) => {
      images[question.id] = await getQuestionImages(question.id);
    }),
  );

  return {
    kind: 'open',
    data: {
      simulationId,
      status: detail.data.status ?? null,
      statementId,
      deadline: detail.data.deadline ?? null,
      title: statement.data.title || 'Prova',
      subtitle: subjectLine(statement.data),
      questions,
      images,
      saved,
      answered: [...answeredQuestionIds(answers, simulationId)],
    },
  };
}

/** The second line of the header. `examType` and `totalMaxScore` come from the
 *  statement, which is what the student is looking at; a missing one leaves the
 *  line empty rather than inventing a label the backend never sent. */
function subjectLine(statement: StatementFull): string {
  return [
    statement.examType,
    statement.totalMaxScore != null ? `${statement.totalMaxScore} valores` : null,
    statement.durationMinutes != null ? `${statement.durationMinutes} min` : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

/** The account id that owns a new attempt. A session without one cannot start
 *  anything: the backend refuses a simulation whose accountId is not the caller's
 *  (SimulationService.java:103), so starting here would only earn a 403. */
export async function myAccountId(): Promise<number | null> {
  const me = await getMe();
  return me?.accountId ?? null;
}

/** How many questions are answerable with a tap, for the room's own copy. */
export function choiceCount(questions: ExamQuestion[]): number {
  return questions.filter(isChoice).length;
}

export { type ExamOption, type ExamQuestion, type SavedAnswer };
