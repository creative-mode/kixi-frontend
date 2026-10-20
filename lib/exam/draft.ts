import { mathNeedsReview, serializeMathText, type MathContentFields, type MathFormula, type MathContentBlock } from '../../student/lib/shared/math-types.ts';

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

/** The kinds of question the builder writes. `group` is a question with sub-items (alíneas):
 *  it carries the common statement and no answer of its own, the answers live in its items. */
export type QuestionKind = 'open' | 'multiple_choice' | 'true_false' | 'group';
export type LeafKind = Exclude<QuestionKind, 'group'>;

/** An alínea: a question of its own inside a `group`. The label (a, b, c…) is generated. */
export interface DraftItem extends MathContentFields {
  /** Source label when OCR imports a paper whose alíneas do not start at a. */
  label?: string;
  text: string;
  points: number | '';
  options: DraftOption[];
  /** Absent in drafts written before kinds existed; `kindOf` derives it from the options. */
  kind?: LeafKind;
  /** Marked by the OCR import when the engine was not sure, so the teacher looks at it. */
  review?: boolean;
  /** Explicit acknowledgement of low-confidence OCR evidence. */
  reviewed?: boolean;
  /** A resposta esperada de uma questão aberta, para a chave. Só o pessoal a recebe. */
  modelAnswer?: string;
}

/** A figure, table or formula the OCR cut out of the page and tied to a question. It lives only in the open
 *  builder (the draft kept in the browser leaves it out: a picture does not fit there), and is sent once the
 *  exam is saved, to the question it belongs to. */
export interface DraftImage {
  dataUrl: string;
  caption: string;
  kind?: string;
}

export interface DraftQuestion extends MathContentFields {
  text: string;
  /** `''` means "not scored yet". It is not the same as zero, and the difference matters below. */
  points: number | '';
  options: DraftOption[];
  kind?: QuestionKind;
  /** Only for `group`. */
  items?: DraftItem[];
  review?: boolean;
  /** Explicit acknowledgement of low-confidence OCR evidence. */
  reviewed?: boolean;
  /** A resposta esperada de uma questão aberta, para a chave. Só o pessoal a recebe. */
  modelAnswer?: string;
  /** Figures of the question, in page order. */
  images?: DraftImage[];
}

type ReviewableContent = Pick<DraftQuestion, 'text' | 'formulas' | 'blocks' | 'reviewed'>;

/** Invalidates a teacher acknowledgement when the OCR/math content changes. */
export function invalidateReviewOnContentChange<T extends ReviewableContent>(previous: T, next: T): T {
  const contentChanged = previous.text !== next.text
    || JSON.stringify(previous.formulas ?? []) !== JSON.stringify(next.formulas ?? [])
    || JSON.stringify(previous.blocks ?? []) !== JSON.stringify(next.blocks ?? []);

  return contentChanged ? { ...next, reviewed: false } : next;
}

/** What goes to the server after the exam is created: each figure with the number its question gets
 *  (the position among the questions that are sent, as `toRequest` filters out the empty ones). */
export interface Figure {
  number: number;
  caption: string;
  dataUrl: string;
}

export function figuresOf(questions: DraftQuestion[]): Figure[] {
  return questions
    .filter((q) => q.text.trim())
    .flatMap((q, i) => (q.images ?? []).map((image) => ({ number: i + 1, caption: image.caption, dataUrl: image.dataUrl })));
}

/** The draft without its figures, which is how it is kept in the browser. */
export function withoutImages<T extends { items: DraftQuestion[] }>(draft: T): T {
  return { ...draft, items: draft.items.map((question) => { const kept = { ...question }; delete kept.images; return kept; }) };
}

/** The two options of a true/false question: the backend has no boolean answer, it grades by the
 *  option marked correct, so "true" and "false" are two ordinary options. */
export const TRUE_FALSE_TEXTS = ['Verdadeiro', 'Falso'] as const;

/** The kind of a question or item, from what it holds when `kind` was never set. */
export function kindOf(q: { kind?: QuestionKind; options: DraftOption[]; items?: DraftItem[] }): QuestionKind {
  if (q.kind) return q.kind;
  if (q.items && q.items.length > 0) return 'group';
  return q.options.length > 0 ? 'multiple_choice' : 'open';
}

/** `A` Verdadeiro and `B` Falso, with the answer marked or not. */
export function trueFalseOptions(answer: 'V' | 'F' | null = null): DraftOption[] {
  return [
    { label: 'A', text: TRUE_FALSE_TEXTS[0], correct: answer === 'V' },
    { label: 'B', text: TRUE_FALSE_TEXTS[1], correct: answer === 'F' },
  ];
}

/** Which answer a true/false question has marked. */
export function trueFalseAnswer(options: DraftOption[]): 'V' | 'F' | null {
  const marked = options.findIndex((o) => o.correct);
  return marked === 0 ? 'V' : marked === 1 ? 'F' : null;
}

/** An empty alínea of a kind. */
export function emptyItem(kind: LeafKind = 'open'): DraftItem {
  return { text: '', points: '', kind, options: kind === 'true_false' ? trueFalseOptions() : [] };
}

/** `a`, `b`, `c`… and `aa` after `z`: the labels the alíneas of a question carry. */
export function itemLabel(index: number): string {
  let n = index;
  let out = '';
  do {
    out = String.fromCharCode(97 + (n % 26)) + out;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return out;
}

/** Keep Roman section labels and their lettered children alongside ordinary a/b/c labels. */
export function normalizeSourceItemLabel(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const label = value.trim().replace(/[).]+$/, '');
  const roman = label.match(/^(VIII|VII|VI|V)(?:\.([a-z]+))?$/i);
  if (roman) return roman[2] ? `${roman[1].toUpperCase()}.${roman[2].toLowerCase()}` : roman[1].toUpperCase();
  if (/^[a-z]+$/i.test(label)) return label.toLowerCase();
  return undefined;
}

/** Preserve a printed OCR label; generated labels remain the fallback for new items. */
export function sourceItemLabel(item: Pick<DraftItem, 'label'>, index: number): string {
  return normalizeSourceItemLabel(item.label) ?? itemLabel(index);
}

/**
 * Changes the kind of a question keeping what can be kept: the text and the score survive, the
 * options belong to the kind they were written for.
 *
 * Going to `group` turns the question into the common statement of one empty alínea (its own
 * score moves to that alínea, so nothing the teacher typed is lost); coming back from `group`
 * keeps the statement and drops the alíneas, which is what the confirmation in the editor is for.
 */
export function convertKind(q: DraftQuestion, kind: QuestionKind): DraftQuestion {
  const from = kindOf(q);
  if (from === kind) return q;
  if (kind === 'group') {
    return { ...q, kind, options: [], points: '', items: [{ ...emptyItem('open'), points: q.points }] };
  }
  const base: DraftQuestion = { ...q, kind, items: undefined };
  if (kind === 'open') return { ...base, options: [] };
  if (kind === 'true_false') return { ...base, options: trueFalseOptions() };
  // multiple_choice: keeps the options it had, or starts with two empty ones
  return { ...base, options: from === 'open' || from === 'group' || from === 'true_false'
    ? [{ label: 'A', text: '', correct: false }, { label: 'B', text: '', correct: false }]
    : q.options };
}

/** Same conversion for an alínea (never a group). */
export function convertItemKind(item: DraftItem, kind: LeafKind): DraftItem {
  const converted = convertKind({ text: item.text, points: item.points, options: item.options, kind: kindOf(item) }, kind);
  return { ...item, kind, options: converted.options };
}

/** The questions that are answered: the question itself, or each alínea of a group. */
export interface Leaf { label: string; question: number; text: string; points: number | ''; options: DraftOption[]; kind: LeafKind }

/** `3a`, `3b`… for alíneas and `5` for a question; `question` is the number the backend will
 *  give the top-level question (rows without text do not count, see `problems`). */
export function leavesOf(questions: DraftQuestion[]): Leaf[] {
  const filled = questions.filter((q) => q.text.trim());
  const out: Leaf[] = [];
  filled.forEach((q, i) => {
    const n = i + 1;
    if (kindOf(q) === 'group') {
      (q.items ?? []).forEach((item, j) => {
        out.push({ label: `${n}${sourceItemLabel(item, j)}`, question: n, text: item.text, points: item.points, options: item.options, kind: kindOf(item) as LeafKind });
      });
    } else {
      out.push({ label: String(n), question: n, text: q.text, points: q.points, options: q.options, kind: kindOf(q) as LeafKind });
    }
  });
  return out;
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
 * The score the statement is worth: the sum of the answered leaves that have one.
 *
 * `ManualStatementService.totalScore` filters out the nulls rather than counting them as
 * zero, and so does `calculateTotalMaxScore` in the approval gate. That is why a question
 * left without a score does not read as "0" here — it reads as *not counted*, and the
 * declared total quietly comes out lower than the sheet of questions suggests. The caller
 * shows the total and the gap; this only answers what the backend will store.
 *
 * A group has no score of its own: it is worth the sum of its alíneas.
 */
export function totalScore(questions: DraftQuestion[]): number {
  return round2(leavesOf(questions).reduce((sum, l) => sum + (l.points === '' ? 0 : Number(l.points)), 0));
}

/** The leaves the backend will not count towards the total, so the teacher sees them. */
export function unscored(questions: DraftQuestion[]): number {
  return leavesOf(questions).filter((l) => l.text.trim() && l.points === '').length;
}

/** The score of a group is the sum of its alíneas, shown by the editor as a read-only value. */
export function groupScore(q: DraftQuestion): number {
  return round2((q.items ?? []).reduce((sum, i) => sum + (i.points === '' ? 0 : Number(i.points)), 0));
}

/**
 * Whether a statement like this can be approved.
 *
 * Both failures come from `StatementService`: `answerKeyComplete` refuses a question that
 * has options and no option marked correct, and `requireTheScoresToAddUp` refuses a total
 * that does not match the questions. Failing here means the teacher finds out before
 * saving, not after — the server would say the same thing, just later and with a 422.
 *
 * True/false is a question with two options, so the first rule covers it with its own words.
 */
export function problems(questions: DraftQuestion[]): string[] {
  const out: string[] = [];
  const filled = questions.filter((q) => q.text.trim());
  const leaves = leavesOf(questions);
  const labels = (list: Leaf[]) => list.map((l) => l.label).join(', ');

  const withoutKey = leaves.filter((l) => l.kind === 'multiple_choice' && l.options.length > 0 && !l.options.some((o) => o.correct));
  if (withoutKey.length > 0) {
    out.push(`Falta marcar a resposta correcta na questão ${labels(withoutKey)}.`);
  }
  const withoutTruth = leaves.filter((l) => l.kind === 'true_false' && trueFalseAnswer(l.options) === null);
  if (withoutTruth.length > 0) {
    out.push(`Falta marcar Verdadeiro ou Falso na questão ${labels(withoutTruth)}.`);
  }
  if (leaves.some((l) => l.options.length > 0 && l.options.some((o) => o.text.trim().length === 0))) {
    out.push('Há opções por escrever. Cada opção precisa de texto.');
  }
  // O rótulo em falta é o outro invariante, e `optionsFor` já não o inventa: se
  // chegasse vazio, ia sair vazio e o `UNIQUE (question_id, option_label)` rebentava
  // a meio do POST. Dizer aqui é mais barato do que apanhar essa excepção depois.
  const unlabelled = leaves.filter((l) => l.options.some((o) => !o.label));
  if (unlabelled.length > 0) {
    out.push(`Há opções sem rótulo na questão ${labels(unlabelled)}. Apaga-as e escreve-as de novo.`);
  }
  const emptyGroups = filled.filter((q) => kindOf(q) === 'group' && (q.items ?? []).length === 0);
  if (emptyGroups.length > 0) {
    out.push(`A questão ${emptyGroups.map((q) => filled.indexOf(q) + 1).join(', ')} tem alíneas mas nenhuma escrita.`);
  }
  const emptyItems = leaves.filter((l) => l.question && !l.text.trim() && /[a-z]$/.test(l.label));
  if (emptyItems.length > 0) {
    out.push(`Há alíneas por escrever: ${labels(emptyItems)}.`);
  }
  const pendingReview = filled.flatMap((question, index) => {
    const pending: string[] = [];
    if ((question.review || mathNeedsReview(question.formulas, question.blocks)) && !question.reviewed) pending.push(String(index + 1));
    (question.items ?? []).forEach((item, itemIndex) => {
      if ((item.review || mathNeedsReview(item.formulas, item.blocks)) && !item.reviewed) pending.push(`${index + 1}${sourceItemLabel(item, itemIndex)}`);
    });
    return pending;
  });
  if (pendingReview.length > 0) {
    out.push(`Reveja a confiança OCR antes de publicar: ${pendingReview.join(', ')}.`);
  }
  const missing = unscored(questions);
  if (missing > 0) {
    out.push(`${missing} questão(ões) sem cotação, e uma questão sem cotação não conta para o total.`);
  }
  return out;
}

/**
 * Fills the leaves that have no score so the exam adds up to `total` (20 values by default,
 * the scale of an Angolan exam). It never touches a score that is already there: what the teacher
 * typed, or what the paper printed, is the truth.
 *
 * The share is the same for every empty leaf, rounded down to half a value because that is the
 * grain scores are written in; what the rounding leaves over goes to the last empty leaf, so the
 * total is exact. When the scores already typed use up the total there is nothing to distribute and
 * the questions come back unchanged: inventing zeros would pass for a decision nobody made.
 */
export function distributeScore(questions: DraftQuestion[], total = 20): DraftQuestion[] {
  const empty: { q: number; item: number | null }[] = [];
  let used = 0;
  questions.forEach((q, qi) => {
    if (!q.text.trim()) return;
    if (kindOf(q) === 'group') {
      (q.items ?? []).forEach((item, ii) => {
        if (item.points === '') empty.push({ q: qi, item: ii });
        else used += Number(item.points);
      });
    } else if (q.points === '') empty.push({ q: qi, item: null });
    else used += Number(q.points);
  });
  const remaining = round2(total - used);
  if (empty.length === 0 || remaining <= 0) return questions;

  const share = Math.floor(remaining / empty.length / 0.5) * 0.5;
  const leftover = round2(remaining - share * empty.length);
  const pointsFor = (n: number) => (n === empty.length - 1 ? round2(share + leftover) : share);
  return questions.map((q, qi) => {
    const mine = empty.map((e, n) => ({ e, n })).filter(({ e }) => e.q === qi);
    if (mine.length === 0) return q;
    if (kindOf(q) === 'group') {
      return { ...q, items: (q.items ?? []).map((item, ii) => {
        const hit = mine.find(({ e }) => e.item === ii);
        return hit ? { ...item, points: pointsFor(hit.n) } : item;
      }) };
    }
    return { ...q, points: pointsFor(mine[0].n) };
  });
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

export interface RequestOption { label: string; text: string; correct: boolean }
export interface RequestItem {
  label: string; text: string; type: LeafKind; maxScore: number | null; options: RequestOption[];
  /** Matches ManualStatementRequest.Item; blocks are encoded in text and formulas. */
  rawText?: string; confidence?: number | null; reviewed?: boolean; formulas?: MathFormula[];
}
export interface RequestQuestion {
  text: string;
  type: QuestionKind;
  /** `null` for a group: its score is the sum of its items. */
  maxScore: number | null;
  /** Empty for `open` and for a group. */
  options: RequestOption[];
  /** Only for a group. */
  items?: RequestItem[];
  /** Matches ManualStatementRequest.Question; `needsReview` is derived by the backend. */
  rawText?: string; confidence?: number | null; reviewed?: boolean; formulas?: MathFormula[];
}

function formulaEvidence(formulas?: MathFormula[], blocks?: MathContentBlock[]): MathFormula[] | undefined {
  const blockFormulas = (blocks ?? [])
    .filter((block): block is Extract<MathContentBlock, { type: 'formula' }> => block.type === 'formula')
    .map(({ raw, latex, confidence, kind }) => ({
      raw,
      ...(latex !== undefined ? { latex } : {}),
      ...(confidence !== undefined ? { confidence } : {}),
      ...(kind !== undefined ? { kind } : {}),
    }));
  const all = [...(formulas ?? []), ...blockFormulas];
  const seen = new Set<string>();
  const unique = all.filter((formula) => {
    const key = `${formula.raw}\u0000${formula.latex ?? ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return unique.length ? unique : undefined;
}

function ocrEvidence(item: MathContentFields & { reviewed?: boolean }) {
  const formulas = formulaEvidence(item.formulas, item.blocks);
  return {
    ...(item.rawText !== undefined ? { rawText: item.rawText } : {}),
    ...(item.confidence != null ? { confidence: item.confidence } : {}),
    // `review` means review is required; `reviewed` is the teacher's acknowledgement.
    // ManualStatementService derives needsReview from confidence/formula evidence.
    ...(item.reviewed === true ? { reviewed: true } : {}),
    ...(formulas ? { formulas } : {}),
  };
}

/**
 * The draft as `POST /api/v1/statements/manual` wants it.
 *
 * Questions with no text are dropped rather than sent: `QuestionRequest.text` is
 * `@NotBlank`, so an empty row in the editor is a 400 that names a field the teacher
 * cannot see, for a question that was never meant to exist.
 *
 * A `group` goes without options and without a score: the common statement and its items, each
 * with its own kind, score and options. A true/false leaf always goes with its two options.
 */
export function toRequest(questions: DraftQuestion[]): RequestQuestion[] {
  const leafOptions = (kind: LeafKind, options: DraftOption[]): RequestOption[] =>
    kind === 'open' ? [] : optionsFor({ text: '', points: '', options });
  return questions
    .filter((q) => q.text.trim())
    .map((q): RequestQuestion => {
      const kind = kindOf(q);
      if (kind === 'group') {
        return {
          text: serializeMathText(q.text, q.formulas, q.blocks).trim(),
          type: 'group',
          maxScore: null,
          options: [],
          items: (q.items ?? [])
            .filter((i) => i.text.trim())
            .map((i, j) => {
              const k = kindOf(i) as LeafKind;
              return { label: sourceItemLabel(i, j), text: serializeMathText(i.text, i.formulas, i.blocks).trim(), type: k, maxScore: i.points === '' ? null : Number(i.points), options: leafOptions(k, i.options), ...ocrEvidence(i) };
            }),
          ...ocrEvidence(q),
        };
      }
      return {
        text: serializeMathText(q.text, q.formulas, q.blocks).trim(),
        type: kind,
        maxScore: q.points === '' ? null : Number(q.points),
        options: leafOptions(kind as LeafKind, q.options),
        ...ocrEvidence(q),
      };
    });
}
