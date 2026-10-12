/** The result screen's rules, with no server and no React, so `node --test` can reach
 *  them. Everything shown comes from `GET /simulations/{id}/result`: the screen adds
 *  nothing of its own, because a number the server did not compute is a number that
 *  can disagree with it (the criterion is "os números batem com os do servidor").
 *
 *  Two facts about the server shape what is here:
 *  - an open answer is graded by the teacher, so it can be PENDING_REVIEW with no
 *    score and no verdict. That is not a wrong answer and is never counted as one;
 *  - the result only exists once the simulation is FINISHED (409 before), which is
 *    also what keeps the answer key out of the room. */

export interface ResultOption {
  id: number;
  optionLabel?: string | null;
  optionText: string;
  isCorrect?: boolean | null;
}

export interface ResultQuestion {
  questionId: number;
  number: number;
  text: string;
  maxScore?: number | null;
  correctOptionId?: number | null;
  modelAnswer?: string | null;
  selectedOptionId?: number | null;
  answerText?: string | null;
  scoreObtained?: number | null;
  isCorrect?: boolean | null;
  reviewStatus?: string | null;
  options?: ResultOption[];
}

export interface SimulationResult {
  simulationId: number;
  status?: string | null;
  finalScore?: number | null;
  correctAnswers?: number | null;
  totalQuestions?: number | null;
  pendingReviewCount?: number | null;
  timeSpentSeconds?: number | null;
  questions?: ResultQuestion[];
}

export type Verdict = 'correct' | 'wrong' | 'pending' | 'blank';

/** What to say about one question. `isCorrect` null with a pending review is the
 *  teacher's to decide; null with no answer at all is a blank. */
export function verdict(q: ResultQuestion): Verdict {
  if ((q.reviewStatus ?? '').toUpperCase() === 'PENDING_REVIEW') return 'pending';
  if (q.isCorrect === true) return 'correct';
  const answered = q.selectedOptionId != null || (q.answerText ?? '').trim().length > 0;
  if (!answered) return 'blank';
  return q.isCorrect === false ? 'wrong' : 'pending';
}

/** The questions in the order of the paper. */
export function inOrder(questions: ResultQuestion[] | undefined): ResultQuestion[] {
  return [...(questions ?? [])].sort((a, b) => a.number - b.number);
}

/** Questions the student should look at again: everything that is not right and not
 *  waiting for the teacher. */
export function toReview(questions: ResultQuestion[] | undefined): ResultQuestion[] {
  return inOrder(questions).filter((q) => {
    const v = verdict(q);
    return v === 'wrong' || v === 'blank';
  });
}

/**
 * What the student answered to each wrong question, for the tutor link.
 *
 * An objective answer is the text of the option they chose, not its letter: the tutor
 * reads the paper's options, and a letter means nothing without them. A question left
 * blank contributes nothing — there is no answer to explain. Open answers keep the
 * student's own words, since that is what has to be reviewed.
 */
export function givenAnswers(questions: ResultQuestion[] | undefined): Map<number, string> {
  const answers = new Map<number, string>();
  for (const question of toReview(questions)) {
    const answer =
      (question.options?.find((option) => option.id === question.selectedOptionId)?.optionText ?? '').trim()
      || (question.answerText ?? '').trim();
    if (answer) answers.set(question.number, answer);
  }
  return answers;
}

/** `16,4`: the decimal the server computed, with the Portuguese comma. Null stays
 *  null — no score is not a zero. */
export function formatScore(score: number | null | undefined): string | null {
  if (score == null || !Number.isFinite(score)) return null;
  return String(Math.round(score * 100) / 100).replace('.', ',');
}

/** `52 min`, `1 h 05 min`, `45 s`. Null when the server did not say. */
export function formatDuration(seconds: number | null | undefined): string | null {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return null;
  const total = Math.round(seconds);
  if (total < 60) return `${total} s`;
  const minutes = Math.floor(total / 60);
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')} min`;
}

export interface AttemptScore {
  id: number;
  status?: string | null;
  finalScore?: number | null;
}

export interface Comparison {
  previousScore: number;
  /** current - previous, to one decimal: scores are decimals and 16.4 - 14.2 must not
   *  show as 2.1999999999999993. */
  delta: number;
}

/** The attempt just before this one, among the student's finished ones with a score.
 *  An attempt in progress, cancelled, or never graded is not something to compare
 *  with, and a LATER attempt is not "previous". */
export function compareWithPrevious(
  currentId: number,
  currentScore: number | null | undefined,
  attempts: AttemptScore[],
): Comparison | null {
  if (currentScore == null) return null;
  const previous = attempts
    .filter((a) => a.id < currentId && (a.status ?? '').toUpperCase() === 'FINISHED' && a.finalScore != null)
    .sort((a, b) => b.id - a.id)[0];
  if (!previous || previous.finalScore == null) return null;
  return {
    previousScore: previous.finalScore,
    delta: Math.round((currentScore - previous.finalScore) * 10) / 10,
  };
}

/** `+2,2`, `-1,5`, `0`. */
export function formatDelta(delta: number): string {
  if (delta === 0) return '0';
  const text = String(Math.abs(delta)).replace('.', ',');
  return delta > 0 ? `+${text}` : `-${text}`;
}

/** The letter shown for an option: the one the paper gave, or A, B, C by position. */
export function optionTag(option: ResultOption, index: number): string {
  return option.optionLabel?.trim() || String.fromCharCode(65 + index);
}
