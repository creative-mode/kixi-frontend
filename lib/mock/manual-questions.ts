/**
 * As questões de `POST /api/v1/statements/manual` no contrato novo: `type` por questão e, num `group`,
 * as alíneas (`items`). Fora de `backend.ts` porque esse módulo começa com `import 'server-only'`, que um
 * `node --test` não resolve — e estas são as regras que o professor encontra como um 400 depois de ter
 * escrito a prova toda.
 *
 * Numeração, como o backend a dá: as de topo têm o número impresso (1, 2, 3…) e as alíneas têm
 * `pai * 100 + índice` (301, 302…), para a ordem por número continuar a pôr cada alínea depois do pai
 * e antes da questão seguinte, e para o número impresso de uma questão nunca mudar por causa das alíneas.
 */

export interface RawOption { label?: string; text?: string; correct?: boolean }
export interface RawItem { label?: string; text?: string; type?: string; maxScore?: number | null; options?: RawOption[] }
export interface RawQuestion { text?: string; type?: string; maxScore?: number | null; modelAnswer?: string | null; options?: RawOption[]; items?: RawItem[] }

export interface BuiltOption { id: number; questionId: number | null; optionLabel: string; optionText: string; isCorrect: boolean; orderIndex: number; deletedAt: null }
export interface BuiltQuestion {
  id: number;
  statementId: number | null;
  number: number;
  orderIndex: number;
  text: string;
  maxScore: number | null;
  questionType: string;
  parentId: number | null;
  label: string | null;
  pageIndex: null;
  modelAnswer: string | null;
  needsReview: boolean;
  options: BuiltOption[];
}

export type BuildResult = { ok: true; questions: BuiltQuestion[]; total: number } | { ok: false; status: number; message: string };

const LEAF = ['open', 'multiple_choice', 'true_false'] as const;
const fail = (message: string, status = 400): BuildResult => ({ ok: false, status, message });

/** `a`, `b`… `z`, `aa`: o rótulo que o backend dá a uma alínea quando o cliente não o manda. */
export function itemLabelAt(index: number): string {
  let n = index;
  let out = '';
  do {
    out = String.fromCharCode(97 + (n % 26)) + out;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return out;
}

function optionsOf(kind: string, raw: RawOption[] | undefined, where: string): { options: RawOption[] } | { error: string } {
  const given = (raw ?? []).filter((o) => String(o.text ?? '').trim());
  if (kind === 'open') return given.length > 0 ? { error: `${where}: uma questão aberta não tem opções` } : { options: [] };
  if (kind === 'true_false') {
    const options = given.length === 0 ? [{ label: 'A', text: 'Verdadeiro', correct: false }, { label: 'B', text: 'Falso', correct: false }] : given;
    if (options.length !== 2) return { error: `${where}: verdadeiro/falso tem exatamente duas opções` };
    if (options.filter((o) => o.correct).length > 1) return { error: `${where}: só uma opção pode ser a correta` };
    return { options };
  }
  if (given.length === 0) return { error: `${where}: a escolha múltipla precisa de opções` };
  if (given.filter((o) => o.correct).length > 1) return { error: `${where}: só uma opção pode ser a correta` };
  return { options: given };
}

export function buildQuestions(input: RawQuestion[], nextQuestionId: () => number, nextOptionId: () => number): BuildResult {
  const questions: BuiltQuestion[] = [];
  let total = 0;
  let order = 0;

  const row = (q: { text: string; kind: string; maxScore: number | null; number: number; parentId: number | null; label: string | null; modelAnswer?: string | null; options: RawOption[] }): BuiltQuestion => {
    const id = nextQuestionId();
    return {
      id, statementId: null, number: q.number, orderIndex: order++, text: q.text, maxScore: q.maxScore, questionType: q.kind,
      parentId: q.parentId, label: q.label, pageIndex: null, modelAnswer: q.modelAnswer ?? null, needsReview: false,
      options: q.options.map((o, j) => ({ id: nextOptionId(), questionId: id, optionLabel: String(o.label ?? ''), optionText: String(o.text).trim(), isCorrect: !!o.correct, orderIndex: j, deletedAt: null })),
    };
  };

  for (const [i, q] of input.entries()) {
    const n = i + 1;
    const where = `Questão ${n}`;
    const type = q.type ?? ((q.options ?? []).length > 0 ? 'multiple_choice' : 'open');

    if (type === 'group') {
      if ((q.options ?? []).length > 0) return fail(`${where}: uma questão com alíneas não tem opções próprias`);
      if (q.maxScore != null) return fail(`${where}: a cotação de uma questão com alíneas é a soma das alíneas`);
      const items = q.items ?? [];
      if (items.length === 0) return fail(`${where}: uma questão com alíneas precisa de pelo menos uma alínea`);
      const parent = row({ text: String(q.text ?? '').trim(), kind: 'group', maxScore: null, number: n, parentId: null, label: null, options: [] });
      questions.push(parent);
      for (const [j, item] of items.entries()) {
        const label = String(item.label ?? '').trim() || itemLabelAt(j);
        const at = `${where}${label}`;
        if (!String(item.text ?? '').trim()) return fail(`${at}: o texto da alínea é obrigatório`);
        if (!LEAF.includes(item.type as (typeof LEAF)[number])) return fail(`${at}: o tipo da alínea tem de ser open, multiple_choice ou true_false`);
        const opts = optionsOf(item.type as string, item.options, at);
        if ('error' in opts) return fail(opts.error);
        const maxScore = item.maxScore == null ? null : Number(item.maxScore);
        total += maxScore ?? 0;
        questions.push(row({ text: String(item.text).trim(), kind: item.type as string, maxScore, number: n * 100 + (j + 1), parentId: parent.id, label, options: opts.options }));
      }
      continue;
    }

    if (!LEAF.includes(type as (typeof LEAF)[number])) return fail(`${where}: tipo de questão desconhecido «${type}»`);
    if ((q.items ?? []).length > 0) return fail(`${where}: só uma questão do tipo group leva alíneas`);
    if (!String(q.text ?? '').trim()) return fail(`${where}: o texto é obrigatório`);
    const opts = optionsOf(type, q.options, where);
    if ('error' in opts) return fail(opts.error);
    const maxScore = q.maxScore == null ? null : Number(q.maxScore);
    total += maxScore ?? 0;
    questions.push(row({ text: String(q.text).trim(), kind: type, maxScore, number: n, parentId: null, label: null, modelAnswer: q.modelAnswer, options: opts.options }));
  }
  return { ok: true, questions, total: Math.round((total + Number.EPSILON) * 100) / 100 };
}
