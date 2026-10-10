/**
 * The two things that stop a statement from being approved, as `StatementService`
 * decides them.
 *
 * They live here rather than inline in `mock/backend.ts` because that module starts
 * with `import 'server-only'`, which a plain `node --test` cannot resolve — and
 * because these are the rules the teacher meets as a 422 at the worst moment, after
 * having typed a whole exam. A rule that cannot be tested is a rule that was once
 * the wrong way round without anybody noticing; the same reason
 * `student/lib/mock/school.ts` exists.
 *
 * Both failures name what is missing, on purpose: the messages travel to the screen.
 */

export interface GateStatement {
  totalMaxScore?: number | null;
  questions: { number: number; maxScore?: number | null; deletedAt?: string | null; options?: { isCorrect?: boolean; deletedAt?: string | null }[] }[];
}

/** `StatementService.scaled`: BigDecimal a duas casas, porque a soma volta do R2DBC
 *  em double. `BigDecimal.valueOf(double)`, não `new BigDecimal(double)` — a segunda
 *  é a que está errada, e a diferença lê-se como "0.1 + 0.2 não dá 0.3". */
const scaled = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

const plain = (value: number) => scaled(value).toFixed(2);

/**
 * The 422 the approval gate would return, or null when the statement may be approved.
 *
 * `answerKeyComplete` first: a question that has options and none marked correct.
 * Then `requireTheScoresToAddUp`: the scores of the active questions must equal the
 * declared total, compared at scale 2. A statement with no declared total is left
 * alone — the column is nullable and the OCR statements predate it.
 *
 * Removed rows count for nothing on both sides: `setCorrectOption` and the marking
 * query both ignore them, so a correct flag left on a deleted option is not an
 * answer, and a deleted question is not a score.
 */
export function approvalProblem(statement: GateStatement): string | null {
  const active = statement.questions.filter((q) => !q.deletedAt);

  const unanswered = active
    .filter((q) => (q.options ?? []).length > 0 && !(q.options ?? []).some((o) => !o.deletedAt && o.isCorrect))
    .map((q) => q.number);
  if (unanswered.length > 0) {
    return `These questions have options but no correct option marked: question ${unanswered.join(', ')}`;
  }

  if (statement.totalMaxScore != null) {
    const sum = active.reduce((a, q) => a + (q.maxScore ?? 0), 0);
    if (scaled(sum) !== scaled(statement.totalMaxScore)) {
      return `The question scores add up to ${plain(sum)} but the statement is worth ${plain(statement.totalMaxScore)}`;
    }
  }
  return null;
}