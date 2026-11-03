/** The exam room's rules, with no server and no React, so `node --test` can reach them.
 *
 *  Everything here is a decision that would otherwise be buried in the client
 *  component and could only be checked by hand:
 *
 *  - a question is a choice question when it HAS OPTIONS, not when `questionType`
 *    says so. `questionType` is a free-text column with no enum and no validation
 *    (Question.java:50), and grading branches on `!questionOptions.isEmpty()`
 *    (SimulationSubmissionService.java:98) — the backend's own comment says the
 *    type may be "open" or unset. Branching on the string would draw a radio
 *    group for a question the server grades as open, and vice-versa.
 *  - the countdown comes from the server's `deadline`, never from `durationMinutes`
 *    counted in the browser: the deadline already has the +25% of extra time and
 *    the tolerance the server enforces (SimulationDeadlineService.java:89), and it
 *    is null when the simulation has no time limit at all.
 *  - an answer is created with POST and changed with PUT. There is no upsert: a
 *    second POST for the same question is a 409 (SimulationAnswerService.java:97).
 */

import { isItem, topNumber } from './question-number.ts';
import type { MathContentFields } from './shared/math-types.ts';

export type SimulationStatus = 'IN_PROGRESS' | 'FINISHED' | 'CANCELLED';

export interface ExamQuestion extends MathContentFields {
  id: number;
  number: number;
  text: string;
  questionType?: string | null;
  maxScore?: number | null;
  orderIndex?: number | null;
  options: ExamOption[];
  /** Só numa alínea: a questão a que pertence e a letra (a, b…). Ver `question-number.ts`. */
  parentId?: number | null;
  label?: string | null;
  /** O enunciado comum da questão com alíneas, para o aluno o ler acima de cada alínea. O backend pode
   *  mandá-lo; quando não manda, `orderQuestions` vai buscá-lo à questão pai. */
  parentText?: string | null;
  /** O número da questão inteira (o 3 de 3a), para o cabeçalho do enunciado comum. */
  parentNumber?: number | null;
  ocrConfidence?: number | null;
}

export interface ExamOption {
  id: number;
  optionLabel?: string | null;
  optionText: string;
  orderIndex?: number | null;
}

/** One saved answer, as SimulationAnswerResponse returns it. */
export interface SavedAnswer {
  id: number;
  simulationId: number;
  questionId: number;
  selectedOptionId?: number | null;
  answerText?: string | null;
}

export interface SimulationSummary {
  id: number;
  status?: string | null;
  deadline?: string | null;
  finalScore?: number | null;
  statement?: { id?: number | null; title?: string | null } | null;
}

/** The answer body SimulationAnswerRequest takes. `answeredAt` is deliberately
 *  absent: the server ignores it when deciding whether time is up
 *  (SimulationAnswerService.java:118) and it is a LocalDateTime, so a `Z` suffix
 *  would fail to parse. The clock belongs to the simulation, not to the browser. */
export interface AnswerRequest {
  simulationId: number;
  questionId: number;
  selectedOptionId: number | null;
  answerText: string | null;
}

/** A question is answered by a choice when it has at least one option. */
export function isChoice(question: ExamQuestion): boolean {
  return question.options.length > 0;
}

/** A questão com alíneas não se responde: é só o enunciado comum, as respostas estão nas alíneas. */
export function isGroup(question: ExamQuestion): boolean {
  return (question.questionType ?? '').toLowerCase() === 'group';
}

/** The questions in the order the student walks them: the order the server sends, which is the order of the paper
 *  (`order_index`, with every alínea right after its parent). The front does not sort by `number`: for an alínea
 *  that number (301, 302…) only exists to be unique, and sorting by it would put 3a after the last question.
 *
 *  The parent leaves the list because there is nothing to answer in it: the student walks the leaves. Each alínea
 *  carries the common statement and the number of the whole question, for the screen to show them. */
export function orderQuestions(questions: ExamQuestion[]): ExamQuestion[] {
  const byId = new Map(questions.map((q) => [q.id, q]));
  const groups = questions.filter(isGroup);
  return questions
    .filter((q) => !isGroup(q))
    .map((q) => {
      if (!isItem(q)) return q;
      const parent = (q.parentId != null ? byId.get(q.parentId) : undefined) ?? groups.find((g) => g.number === topNumber(q.number));
      return {
        ...q,
        parentText: q.parentText ?? parent?.text ?? null,
        parentNumber: q.parentNumber ?? parent?.number ?? topNumber(q.number),
      };
    });
}

/** Builds the request body for an answer. The two fields are mutually exclusive,
 *  because the server grades by what it finds: an option id makes it objective,
 *  text makes it PENDING_REVIEW. Sending both would be graded as objective with
 *  the text ignored. Blank text is sent as null so clearing a box un-answers the
 *  question instead of storing an empty string as an answer to grade.
 *
 *  The selection arrives as a string from the FormData, so it is parsed here rather
 *  than in the component: the membership check against the question's own options is
 *  what rejects an id that belongs to another question. */
export function answerRequest(
  simulationId: number,
  question: ExamQuestion,
  selection: { optionId?: number | string | null; text?: string | null },
): AnswerRequest {
  if (isChoice(question)) {
    const optionId = Number(selection.optionId);
    const known = question.options.some((o) => o.id === optionId);
    return {
      simulationId,
      questionId: question.id,
      selectedOptionId: known ? optionId : null,
      answerText: null,
    };
  }
  const text = (selection.text ?? '').trim();
  return {
    simulationId,
    questionId: question.id,
    selectedOptionId: null,
    answerText: text.length > 0 ? text : null,
  };
}

/** Whether a question counts as answered, from what is saved on the server.
 *  An option id with no option, or an answer to another simulation, is not an
 *  answer to this question — a corrupt row must not light up the map. */
export function answeredQuestionIds(answers: SavedAnswer[], simulationId: number): Set<number> {
  const ids = new Set<number>();
  for (const answer of answers) {
    if (answer.simulationId !== simulationId) continue;
    const hasOption = Number.isInteger(Number(answer.selectedOptionId)) && Number(answer.selectedOptionId) > 0;
    const hasText = typeof answer.answerText === 'string' && answer.answerText.trim().length > 0;
    if (hasOption || hasText) ids.add(answer.questionId);
  }
  return ids;
}

/** The saved answer for one question, to fill the form when the student resumes. */
export function savedAnswerFor(
  answers: SavedAnswer[],
  simulationId: number,
  questionId: number,
): SavedAnswer | undefined {
  return answers.find((a) => a.simulationId === simulationId && a.questionId === questionId);
}

export type CellState = 'done' | 'flag' | 'empty' | 'unsaved';

/** A cell of the map. `answered` is what the SERVER has confirmed, never the local
 *  draft: a cell that says "respondida" for an answer that is still in flight, or
 *  that failed, would let the student hand in an incomplete proof believing nothing
 *  is missing. A question whose answer is not safe yet shows as `unsaved`, ahead of
 *  everything else, because it is the one state the student has to act on.
 *
 *  Flagged wins over answered: "mark for review" is a statement about the student's
 *  intent to come back, and answered alone would hide a question they wanted to see
 *  again. */
export function cellState(
  questionId: number,
  answered: ReadonlySet<number>,
  flagged: ReadonlySet<number>,
  unsaved: ReadonlySet<number> = new Set(),
): CellState {
  if (unsaved.has(questionId)) return 'unsaved';
  if (flagged.has(questionId)) return 'flag';
  if (answered.has(questionId)) return 'done';
  return 'empty';
}

/** The backend's wall clock is Angola's, UTC+1 all year (no daylight saving). Its
 *  LocalDateTime fields carry no zone, so the offset has to come from here. */
export const SERVER_OFFSET = '+01:00';

/** Reads a timestamp the backend sent. A value without a zone is the server's wall
 *  clock, so it is read with the explicit offset and not in whatever zone the browser
 *  happens to be in: a phone set to another zone would otherwise count down hours too
 *  many or too few. A value that already names a zone (`Z`, `+hh:mm`) is left alone.
 *  Returns NaN for what does not parse. */
export function parseServerTime(value: string): number {
  const hasZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value.trim());
  return Date.parse(hasZone ? value : `${value}${SERVER_OFFSET}`);
}

/**
 * Milliseconds left until the deadline, or null when there is no deadline.
 *
 * The backend sends LocalDateTime without a zone; it is read as the server's wall
 * clock (`parseServerTime`). A value that does not parse yields null rather than a
 * guess: showing a wrong countdown is worse than showing none, and the server
 * refuses late answers either way.
 */
export function remainingMs(deadline: string | null | undefined, now: number): number | null {
  if (!deadline) return null;
  const at = parseServerTime(deadline);
  if (Number.isNaN(at)) return null;
  return at - now;
}

/** The server keeps taking answers for a few seconds after the nominal end
 *  (`app.simulations.tolerance-seconds`, 10 by default). The student's clock does not
 *  count that grace: a 60 minute exam must start at 60:00, not 1:00:09, and a clock
 *  that reaches 00:00 while the form still accepts answers is the kind side of the same
 *  margin. The form keeps using the real deadline. */
export const GRACE_MS = 10_000;

export function displayRemainingMs(left: number | null): number | null {
  return left === null ? null : Math.max(0, left - GRACE_MS);
}

/** What the header shows, which is not the same as the number of milliseconds left.
 *
 *  Three states, and the distinction is the point:
 *
 *  - `a-contar`: the clock has not started in this browser yet. The room is a client
 *    component but the server renders it too, and its `Date.now()` is not the
 *    student's. Ticking during render would give a different value on each side and
 *    React would report the divergence, so the first paint shows a dash.
 *  - `sem-limite`: the simulation genuinely has no deadline, which is real and not an
 *    error — a statement without `durationMinutes` never expires
 *    (SimulationDeadlineService.java:89).
 *  - `restante`: a deadline, and what is left of it.
 *
 *  Folding `a-contar` into `sem-limite` would tell a student whose exam is counting
 *  down that the exam has no time limit. */
export type Timer = 'a-contar' | 'sem-limite' | 'restante';

export function timer(deadline: string | null | undefined, now: number | null): Timer {
  if (now === null) return 'a-contar';
  return remainingMs(deadline, now) === null ? 'sem-limite' : 'restante';
}

/** `m:ss`, or `h:mm:ss` past the hour. Negative time clamps to zero: the room
 *  keeps counting visibly at 00:00 while the server closes the simulation, instead
 *  of showing -0:01 and looking broken. */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
}

/** How pressing the countdown looks, from the time the student actually sees — the
 *  one passed here has to be `displayRemainingMs`, so the thresholds land on the
 *  number on screen rather than on the server's real deadline (which runs 10 s later).
 *
 *  The UX audit (M11) found that a clock that only turns red when the room is
 *  already closed tells a SEEING student nothing at the 5-minute and 1-minute marks,
 *  where what still can be done matters:
 *
 *  - `calmo`: more than 5 minutes, or no limit — the clock looks as before.
 *  - `alerta`: 5 minutes or less — amber, the student should start wrapping up.
 *  - `critico`: 1 minute or less — red plus a nudge to hand in what is saved.
 *
 *  Colour alone is not the signal (audit criterion: style AND text, never only
 *  colour); this value only chooses the palette. The text lives in the room. */
export type Urgency = 'calmo' | 'alerta' | 'critico';

export function urgencyOf(displayLeft: number | null): Urgency {
  if (displayLeft === null) return 'calmo';
  if (displayLeft <= 60_000) return 'critico';
  if (displayLeft <= 300_000) return 'alerta';
  return 'calmo';
}

/** The simulation to carry on with, out of the student's own attempts.
 *
 *  The attempt in progress always wins over a newer finished one: opening the room
 *  must resume what the student is doing, not jump to an old attempt. A finished
 *  one is returned as-is so the caller can send the student to the result instead
 *  of starting a second attempt they did not ask for. */
export function attemptFor(simulations: SimulationSummary[], statementId: number): SimulationSummary | null {
  const mine = simulations.filter((s) => Number(s.statement?.id) === statementId);
  if (mine.length === 0) return null;
  return (
    mine.find((s) => (s.status ?? '').toUpperCase() === 'IN_PROGRESS') ??
    mine.reduce((a, b) => (Number(b.id) > Number(a.id) ? b : a))
  );
}

/** Whether a room can still take answers. The client stops the form on the same
 *  conditions the server does — not IN_PROGRESS, or past the deadline — so the
 *  student is not invited to answer into a 409. */
export function acceptsAnswers(
  simulation: SimulationSummary | null,
  now: number,
): boolean {
  if (!simulation) return false;
  if ((simulation.status ?? '').toUpperCase() !== 'IN_PROGRESS') return false;
  const left = remainingMs(simulation.deadline, now);
  return left === null || left > 0;
}

/** The backend answers in English, and the student reads Portuguese. Only the
 *  messages the room can actually provoke are translated; anything else is shown as
 *  the server sent it, which beats a generic sentence that hides the cause. */
const KNOWN_ERRORS: [RegExp, string][] = [
  [/already been answered/i, 'Esta questão já tinha uma resposta. A guardar de novo…'],
  [/time allowed.*expired/i, 'O tempo desta prova terminou.'],
  [/no longer accepts answers/i, 'Esta prova já não aceita respostas.'],
  [/already been submitted/i, 'Esta prova já foi entregue.'],
  [/open questions cannot select an option/i, 'Esta questão é de resposta escrita: não aceita uma opção.'],
  [/currently assigned to an exam room/i, 'Esta prova está atribuída a uma sala de prova e só se faz lá.'],
  [/does not belong to the authenticated account/i, 'Esta tentativa não é da tua conta.'],
  [/statement not found/i, 'Esta prova já não está disponível.'],
  [/simulation not found/i, 'Não encontrámos esta tentativa.'],
];

export function translateError(message: string): string {
  return KNOWN_ERRORS.find(([pattern]) => pattern.test(message))?.[1] ?? message;
}

/** Whether a failed write is worth trying again: the network or the server had a bad
 *  moment (status 0 or 5xx), as opposed to a refusal that a repeat cannot change. */
export function isTransient(status: number): boolean {
  return status === 0 || status === 408 || status === 429 || status >= 500;
}

/** Wait before retry number `attempt` (1-based): 1s, 2s, 4s, capped at 8s. */
export function backoffMs(attempt: number): number {
  return Math.min(8000, 1000 * 2 ** Math.max(0, attempt - 1));
}
