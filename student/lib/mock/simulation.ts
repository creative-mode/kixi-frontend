/** The simulation rules, pure, so `node --test` can reach them and `mock/backend.ts`
 *  only has to wire them to the store. Mirrors creative-mode/kixi
 *  (services/backend-api), so the room is designed against the real contract
 *  instead of a convenient one:
 *
 *  - `SimulationDeadlineService.java:29-31`: a minute is 60 seconds, or 75 with the
 *    +25% of extra time, plus a tolerance of 10 seconds by default (:25). The
 *    returned `deadline` already includes that tolerance, which is why the client
 *    can subtract it and land on the instant the server enforces.
 *  - `SimulationAnswerService.java:95-99`: an answer is created once. A second write
 *    for the same question in the same simulation is a 409, not an update.
 *  - `SimulationSubmissionService.java:96-111`: a question is objective because it
 *    HAS OPTIONS, not because of its type, and it scores all or nothing.
 *  - `SimulationResultService.java:83-90`: the result exists only once FINISHED.
 *  - `CorrectionSummary.java` (kixi#609): the status is derived from the answers,
 *    never stored; `DONE` also covers a paper with objective questions only.
 */

import { parseServerTime } from '../exam-rules.ts';

/** SimulationTimeLimitProperties.toleranceSeconds. */
export const TOLERANCE_SECONDS = 10;

const SECONDS_PER_MINUTE = 60;
/** 1.25 * 60, in whole seconds. */
const EXTRA_TIME_SECONDS_PER_MINUTE = 75;

/** LocalDateTime without a zone, as Jackson serialises it: no `Z`, no offset. It is
 *  the SERVER's wall clock (UTC+1), whatever zone this process runs in, so the mock
 *  and the browser agree on what an unzoned value means (`parseServerTime`). */
export function toLocalDateTime(date: Date): string {
  const shifted = new Date(date.getTime() + 3600 * 1000);
  return shifted.toISOString().slice(0, 19);
}

/**
 * The instant answers stop being accepted, or null when there is nothing to count
 * from. The same null the backend returns: no start, or a statement without a
 * duration, means the simulation never expires — and a room that invents a
 * deadline there would tell the student time is running when it is not.
 */
export function deadlineFor(
  startedAt: string | null,
  durationMinutes: number | null,
  extraTime: boolean,
): string | null {
  if (!startedAt || durationMinutes === null || !Number.isFinite(durationMinutes)) return null;
  const start = parseServerTime(startedAt);
  if (Number.isNaN(start)) return null;
  const perMinute = extraTime ? EXTRA_TIME_SECONDS_PER_MINUTE : SECONDS_PER_MINUTE;
  const end = start + (durationMinutes * perMinute + TOLERANCE_SECONDS) * 1000;
  return toLocalDateTime(new Date(end));
}

/** Whether the server would still take a write. */
export function expired(deadline: string | null, now = Date.now()): boolean {
  if (!deadline) return false;
  const at = parseServerTime(deadline);
  if (Number.isNaN(at)) return false;
  return at <= now;
}

export interface MockQuestion {
  id: number;
  number: number;
  text: string;
  questionType: string;
  maxScore: number;
  orderIndex: number;
  options: { id: number; optionLabel: string; optionText: string; isCorrect: boolean; orderIndex: number }[];
  /** Só numa alínea: a questão a que pertence e a letra. O número é `pai * 100 + índice`, como no backend. */
  parentId?: number | null;
  label?: string | null;
}

/** `AI_GRADED`: uma resposta aberta de uma prova de um plano, corrigida pela IA no fluxo do motor (kixi#542). */
export type MockAnswerStatus = 'PENDING_REVIEW' | 'AUTO_GRADED' | 'AI_GRADED';

export interface MockAnswer {
  id: number;
  simulationId: number;
  questionId: number;
  selectedOptionId: number | null;
  answerText: string | null;
  scoreObtained: number | null;
  isCorrect: boolean | null;
  reviewStatus: MockAnswerStatus | null;
  answeredAt: string | null;
  /** Só nas respostas corrigidas pela IA. */
  aiFeedback?: string | null;
  aiLevel?: string | null;
}

/** Objective means "has options", which is what the backend grades on
 *  (SimulationSubmissionService.java:98) — the question type may be unset. */
export function isObjective(question: MockQuestion): boolean {
  return question.options.length > 0;
}

/** All or nothing, and an open answer stays for the teacher: no options means
 *  PENDING_REVIEW with no score and no verdict, until PATCH .../grade. */
export function gradeAnswer(answer: MockAnswer, question: MockQuestion): MockAnswer {
  if (!isObjective(question)) {
    return { ...answer, scoreObtained: null, isCorrect: null, reviewStatus: 'PENDING_REVIEW' };
  }
  const correct = question.options.find((o) => o.isCorrect);
  const chosen = question.options.find((o) => o.id === answer.selectedOptionId);
  const hit = Boolean(correct && chosen && correct.id === chosen.id);
  return {
    ...answer,
    scoreObtained: hit ? question.maxScore : 0,
    isCorrect: hit,
    reviewStatus: 'AUTO_GRADED',
  };
}

/** The sum of the graded answers, in the fraction the backend reports. */
export function finalScore(answers: MockAnswer[]): number {
  const total = answers.reduce((sum, a) => sum + (a.scoreObtained ?? 0), 0);
  return Math.round(total * 10) / 10;
}

/** Os quatro estados que o backend deriva das respostas (kixi#609). */
export type MockCorrectionStatus = 'PENDING' | 'IN_PROGRESS' | 'DONE' | 'FAILED';

/** A resposta que o e2e (#788) põe a aguardar correção: a primeira aberta. Sem
 *  abertas não há nada para aguardar — uma escolha corrigida pelo gabarito não pode
 *  ficar «por corrigir» (e a rota responde 400 em vez de a marcar). O seed do #793
 *  está corrigido, por isso o teste escolhe a resposta e repõe o estado no fim. */
export function openAnswerOf(answers: readonly MockAnswer[], questions: readonly MockQuestion[]): MockAnswer | undefined {
  return answers.find((a) => {
    const pergunta = questions.find((q) => q.id === a.questionId);
    return pergunta?.questionType === 'open' || pergunta?.questionType === 'development';
  });
}

/** O que a resposta tinha antes de ir a aguardar correção. */
export type ReviewBackup = Pick<MockAnswer, 'id' | 'reviewStatus' | 'scoreObtained' | 'isCorrect'>;

export function backupOf(answer: MockAnswer): ReviewBackup {
  return {
    id: answer.id,
    reviewStatus: answer.reviewStatus,
    scoreObtained: answer.scoreObtained,
    isCorrect: answer.isCorrect,
  };
}

/** Aguardar correção: a nota e o veredicto saem, como numa aberta acabada de entregar. */
export function withPendingReview(answer: MockAnswer): MockAnswer {
  return { ...answer, reviewStatus: 'PENDING_REVIEW', scoreObtained: null, isCorrect: null };
}

/** Repor o que o backup guardou (o teste não pode deixar o próximo com o seed trocado). */
export function withReviewBackup(answer: MockAnswer, backup: ReviewBackup): MockAnswer {
  return {
    ...answer,
    reviewStatus: backup.reviewStatus,
    scoreObtained: backup.scoreObtained,
    isCorrect: backup.isCorrect,
  };
}

/**
 * O estado da correção e se houve alguma resposta aberta corrigida (para saber se
 * `correctedAt` faz sentido). Nenhuma aberta por corrigir é `DONE`, o mesmo caso das
 * provas só com objetivas; algumas já corrigidas é `IN_PROGRESS`.
 */
export function correctionSummary(reviewStatuses: readonly (MockAnswerStatus | null)[]): {
  status: MockCorrectionStatus;
  corrected: boolean;
} {
  const pending = reviewStatuses.filter((s) => s === 'PENDING_REVIEW').length;
  const ai = reviewStatuses.filter((s) => s === 'AI_GRADED').length;
  if (pending > 0) return { status: ai > 0 ? 'IN_PROGRESS' : 'PENDING', corrected: false };
  return { status: 'DONE', corrected: ai > 0 };
}
