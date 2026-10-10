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

/** The label at a position. For displaying an option that has none — assigning one
 *  goes through `nextLabel`, which looks at what is already taken. */
export function labelAt(index: number): string {
  return LABELS[index] ?? String(index + 1);
}

/**
 * The label a new option gets: one past the highest already in use.
 *
 * Not the count of options. `labelFor(options.length)` looks right until the first
 * deletion: with [A,B,C], deleting B leaves [A,C], and adding then hands out
 * `labelFor(2)` = C — a label already taken. The backend has
 * `UNIQUE (question_id, option_label)` and the index does not know about deleted
 * rows, so that is a constraint violation on write, not a tidy 409.
 *
 * Gaps stay gaps on purpose. Reusing B after B was deleted would be ambiguous the
 * next time somebody looked at two revisions of the same question.
 */
export function nextLabel(options: readonly { label?: string }[]): string {
  const highest = options.reduce((max, o) => {
    const i = o.label ? LABELS.indexOf(o.label) : -1;
    return i >= 0 && i > max ? i : max;
  }, -1);
  return labelAt(highest + 1);
}

/**
 * Labels for a draft being read back, one per option.
 *
 * Only options *without* a label get one: a draft saved before labels existed, or
 * one written by an older version. Labels already present are kept verbatim, because
 * reassigning by index would renumber an option that already has an identity —
 * [A,C] would be sent as [A,B], and the teacher who wrote "C" would see "B".
 *
 * The ones being filled in skip the ones already taken, so an old draft that is
 * half-labelled cannot produce two options with the same label.
 */
export function labelsFor(options: readonly { label?: string }[]): string[] {
  const taken = new Set(options.map((o) => o.label).filter((l): l is string => !!l));
  let next = 0;
  return options.map((o) => {
    if (o.label) return o.label;
    while (taken.has(labelAt(next))) next += 1;
    const label = labelAt(next);
    next += 1;
    taken.add(label);
    return label;
  });
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
 *
 * The labels travel exactly as they are. There is deliberately no fallback here —
 * renumbering by index is what this function used to do, and it is the one thing that
 * breaks the invariant: [A,C] went out as [A,B], and reassigning a label an option
 * already owns is a `UNIQUE (question_id, option_label)` violation on write.
 *
 * So a label that arrives empty goes out empty, and `problems()` says so before the
 * teacher ever presses Publish. Inventing one here would be a lie about state the
 * caller is about to persist.
 */
export function optionsFor(question: DraftQuestion): DraftOption[] {
  return question.options.map((option) => ({
    label: option.label,
    text: option.text.trim(),
    correct: option.correct,
  }));
}

/** Options whose label never got assigned — see the invariant `nextLabel` upholds. */
export function missingLabels(question: DraftQuestion): number {
  return question.options.filter((o) => !o.label).length;
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
  // O rótulo em falta é o outro invariante, e `optionsFor` já não o inventa: se
  // chegasse vazio, ia sair vazio e o `UNIQUE (question_id, option_label)` rebentava
  // a meio do POST. Dizer aqui é mais barato do que apanhar essa excepção depois.
  const unlabelled = filled.filter((q) => missingLabels(q) > 0);
  if (unlabelled.length > 0) {
    out.push(
      `Há opções sem rótulo na questão ${unlabelled.map(numberOf).join(', ')}. Apaga-as e escreve-as de novo.`,
    );
  }
  const missing = unscored(questions);
  if (missing > 0) {
    out.push(`${missing} questão(ões) sem cotação, e uma questão sem cotação não conta para o total.`);
  }
  return out;
}

/**
 * Move an item one place up or down, returning a new list.
 *
 * Two slices either side of the two indices, because that is the only way to swap
 * neighbours without disturbing the rest. The version written first sliced at
 * `i + direction` and `max(i, to) + 1`, and it scrambled the list rather than
 * swapping two entries — `down(0)` on `a b c d` gave `a a _ c d`. Reordering was
 * the one thing in this module with no test, which is why it survived the lint,
 * the build and a manual read: nothing failed, the questions just moved wrong.
 */
export function move<T>(list: readonly T[], from: number, direction: -1 | 1): T[] {
  const to = from + direction;
  if (to < 0 || to >= list.length) return [...list];
  const next = [...list];
  [next[from], next[to]] = [next[to], next[from]];
  return next;
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