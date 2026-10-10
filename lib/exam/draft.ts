/**
 * The rules of an exam draft, with no React and no localStorage.
 *
 * They live apart from `lib/exam/schools.ts` because that module reads the browser
 * and because `lib/mock/backend.ts` starts with `import 'server-only'`, which a plain
 * `node --test` cannot resolve. A rule that cannot be tested is a rule that was once the
 * wrong way round without anybody noticing — the same reason `student/lib/mock/school.ts`
 * exists on the student side.
 *
 * What these rules encode is not taste: each one is a way the backend answers otherwise,
 * and each answer costs the teacher something they cannot see.
 */

/** One option of a multiple-choice question. `label` is the identity the backend gives it. */
export interface DraftOption {
  label: string;
  text: string;
  correct: boolean;
}

export interface DraftQuestion {
  text: string;
  /** `''` means "not scored yet". It is not the same as zero, and the difference matters below. */
  points: number | '';
  options: DraftOption[];
}

/** The letters the backend will accept as an option label: at most 10 characters, one per question. */
const LABELS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export function labelFor(index: number): string {
  return LABELS[index] ?? String(index + 1);
}

/** A question is multiple-choice exactly when it has options: `ManualStatementService`
 *  derives `questionType` from `options.isEmpty() ? "open" : "multiple_choice"`, so the
 *  only way to ask for one is to send options. */
export function isChoice(question: DraftQuestion): boolean {
  return question.options.length > 0;
}

/**
 * The options a question is sent with, in order.
 *
 * Empty text is dropped rather than sent: `optionText` is `@NotBlank`, so an option
 * nobody filled in is a 400 that names the field, not a question the teacher can save.
 */
export function optionsFor(question: DraftQuestion): DraftOption[] {
  return question.options.map((option, i) => ({ label: option.label || labelFor(i), text: option.text.trim(), correct: option.correct }));
}

export function optionsReady(question: DraftQuestion): boolean {
  return optionsFor(question).every((o) => o.text.length > 0);
}

/**
 * The score the statement is worth: the sum of the questions that have one.
 *
 * `ManualStatementService.totalScore` filters out the nulls rather than counting them as
 * zero, and so does `calculateTotalMaxScore` in the approval gate. That is why a question
 * left without a score does not read as "0" here — it reads as *not counted*, and the
 * declared total quietly comes out lower than the sheet of questions suggests. The caller
 * shows the total and the gap; this only answers what the backend will store.
 */
export function totalScore(questions: DraftQuestion[]): number {
  return round2(questions.reduce((sum, q) => sum + (q.points === '' ? 0 : Number(q.points)), 0));
}

/** The questions the backend will not count towards the total, so the teacher sees them. */
export function unscored(questions: DraftQuestion[]): number {
  return questions.filter((q) => q.text.trim() && q.points === '').length;
}

/**
 * Whether a statement like this can be approved.
 *
 * Both failures come from `StatementService`: `answerKeyComplete` refuses a question that
 * has options and no option marked correct, and `requireTheScoresToAddUp` refuses a total
 * that does not match the questions. Failing here means the teacher finds out before
 * saving, not after — the server would say the same thing, just later and with a 422.
 */
export function problems(questions: DraftQuestion[]): string[] {
  const out: string[] = [];
  const filled = questions.filter((q) => q.text.trim());
  /** The number the backend will give it: `ManualStatementService.indexed` numbers the
   *  questions that arrive, so an empty row in the middle does not push the rest up. */
  const numberOf = (question: DraftQuestion) => filled.indexOf(question) + 1;

  const withoutKey = filled.filter((q) => isChoice(q) && !q.options.some((o) => o.correct));
  if (withoutKey.length > 0) {
    out.push(`Falta marcar a resposta correcta na questão ${withoutKey.map(numberOf).join(', ')}.`);
  }
  if (filled.some((q) => isChoice(q) && !optionsReady(q))) {
    out.push('Há opções por escrever. Cada opção precisa de texto.');
  }
  const missing = unscored(questions);
  if (missing > 0) {
    out.push(`${missing} questão(ões) sem cotação, e uma questão sem cotação não conta para o total.`);
  }
  return out;
}

/** `0.1 + 0.2` is not `0.3` here, and `StatementService.scaled` compares at scale 2 for
 *  exactly this reason: the scores come back through R2DBC as doubles. */
export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * The draft as `POST /api/v1/statements/manual` wants it.
 *
 * Questions with no text are dropped rather than sent: `QuestionRequest.text` is
 * `@NotBlank`, so an empty row in the editor is a 400 that names a field the teacher
 * cannot see, for a question that was never meant to exist.
 */
export function toRequest(questions: DraftQuestion[]): { text: string; maxScore: number | null; options: { label: string; text: string; correct: boolean }[] }[] {
  return questions
    .filter((q) => q.text.trim())
    .map((q) => ({
      text: q.text.trim(),
      maxScore: q.points === '' ? null : Number(q.points),
      options: isChoice(q) ? optionsFor(q) : [],
    }));
}