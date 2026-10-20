import { kindOf, labelsFor, trueFalseOptions, withoutImages, type DraftItem, type DraftOption, type DraftQuestion, type LeafKind, type QuestionKind } from './draft.ts';
import { mathContentFields } from '../../student/lib/shared/math-types.ts';

export interface School {
  id: string;
  name: string;
  /** URL ou data URI do logótipo */
  logo: string;
  subjects: string[];
}

/** Uma pergunta do rascunho. Reexportado de `lib/exam/draft.ts`, que é onde vivem as regras. */
export type ExamItem = DraftQuestion;

export interface ExamDraft {
  schoolId: string;
  subject: string;
  kind: string;
  grade: string;
  phase: string;
  items: ExamItem[];
  /** Título do enunciado; vazio quer dizer «tipo – disciplina», como sempre foi. */
  title: string;
  /** Duração da prova em minutos; vazio deixa o enunciado sem duração. */
  duration: number | '';
  /** Série/variante (A, B…) e ano letivo tal como vêm no cabeçalho da prova. */
  variant: string;
  schoolYear: string;
  rules: string[];
  note: string;
  place: string;
  date: string;
  teacher: string;
}

export const KINDS = ['Trabalho prático', 'Teste', 'Prova', 'Exame'] as const;

export const EMPTY_DRAFT: ExamDraft = {
  // a escola vem do backend (as afiliadas ao professor); vazio escolhe a primeira
  schoolId: '',
  subject: '',
  kind: 'Trabalho prático',
  grade: '12ª Classe',
  phase: '1ª Fase',
  items: [{ text: '', points: '', options: [] }],
  title: '',
  duration: '',
  variant: '',
  schoolYear: '',
  rules: ['O trabalho deve ser realizado em grupo.', 'Cotação: de 0 a 20 valores.'],
  note: '',
  place: 'Luanda',
  date: '',
  teacher: '',
};

const DRAFT_KEY = 'kixi-exam-draft';

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* quota / modo privado */ }
}

/**
 * A pergunta como o app a guarda, seja ela de que versão do rascunho veio.
 *
 * O rascunho vive em localStorage e a forma mudou quando as opções entraram: um
 * `items` guardado antes disso traz `{ text, points }` e não tem `options`. Um merge
 * ingénuo deixa esse campo a `undefined` e o editor rebenta com `undefined.map` —
 * com a folha de rascunho de um professor a perder-se no primeiro clique depois da
 * actualização. Cada campo é normalizado aqui, e o que não se reconhece perde-se.
 */
function normalizeOptions(raw: unknown): DraftOption[] {
  const rawOptions = (Array.isArray(raw) ? raw : []) as Partial<DraftOption>[];
  // Só as opções sem rótulo recebem um, e `labelsFor` salta os que já estão
  // tomados: um rascunho meio etiquetado não pode dar duas opções com o mesmo
  // rótulo, que é uma violação do `UNIQUE (question_id, option_label)`.
  const labels = labelsFor(rawOptions);
  return rawOptions.map((o, i) => ({
    label: labels[i],
    text: typeof o?.text === 'string' ? o.text : '',
    correct: o?.correct === true,
  }));
}

const LEAF_KINDS: readonly LeafKind[] = ['open', 'multiple_choice', 'true_false'];
const KIND_VALUES: readonly QuestionKind[] = ['open', 'multiple_choice', 'true_false', 'group'];

/** Uma alínea como o app a guarda; um tipo desconhecido volta a derivar-se das opções. */
function normalizeSubItem(raw: Partial<DraftItem> | undefined): DraftItem {
  const options = normalizeOptions(raw?.options);
  const kind = LEAF_KINDS.includes(raw?.kind as LeafKind) ? (raw?.kind as LeafKind) : (kindOf({ options }) as LeafKind);
  return {
    ...(typeof raw?.label === 'string' && /^[a-z]+$/i.test(raw.label.trim()) ? { label: raw.label.trim().toLowerCase() } : {}),
    text: typeof raw?.text === 'string' ? raw.text : '',
    points: typeof raw?.points === 'number' ? raw.points : '',
    options: kind === 'true_false' && options.length !== 2 ? trueFalseOptions() : options,
    kind,
    ...mathContentFields((raw ?? {}) as Record<string, unknown>),
    ...(raw?.review === true ? { review: true } : {}),
    ...(raw?.reviewed === true ? { reviewed: true } : {}),
    ...(typeof raw?.modelAnswer === 'string' && raw.modelAnswer.trim() ? { modelAnswer: raw.modelAnswer } : {}),
  };
}

function normalizeItem(raw: Partial<ExamItem> | undefined): ExamItem {
  const items = Array.isArray(raw?.items) ? raw.items.map(normalizeSubItem) : undefined;
  const options = normalizeOptions(raw?.options);
  const wanted = KIND_VALUES.includes(raw?.kind as QuestionKind) ? (raw?.kind as QuestionKind) : undefined;
  // Um grupo sem alíneas guardadas não é um grupo: o rascunho antigo nunca as teve.
  const kind = wanted === 'group' && !items?.length ? undefined : wanted;
  return {
    text: typeof raw?.text === 'string' ? raw.text : '',
    points: typeof raw?.points === 'number' ? raw.points : '',
    options: kind === 'group' ? [] : options,
    ...(kind ? { kind } : {}),
    ...(kind === 'group' ? { items } : {}),
    ...mathContentFields((raw ?? {}) as Record<string, unknown>),
    ...(raw?.review === true ? { review: true } : {}),
    ...(raw?.reviewed === true ? { reviewed: true } : {}),
    ...(typeof raw?.modelAnswer === 'string' && raw.modelAnswer.trim() ? { modelAnswer: raw.modelAnswer } : {}),
  };
}

/** O rascunho guardado, qualquer que seja a versão que o escreveu. Pura, para se poder testar. */
export function normalizeDraft(saved: Partial<ExamDraft>): ExamDraft {
  return {
    ...EMPTY_DRAFT,
    ...saved,
    items: Array.isArray(saved.items) && saved.items.length > 0 ? saved.items.map(normalizeItem) : EMPTY_DRAFT.items.map(normalizeItem),
    title: typeof saved.title === 'string' ? saved.title : '',
    duration: typeof saved.duration === 'number' ? saved.duration : '',
    variant: typeof saved.variant === 'string' ? saved.variant : '',
    schoolYear: typeof saved.schoolYear === 'string' ? saved.schoolYear : '',
    rules: Array.isArray(saved.rules) ? saved.rules.map((r) => (typeof r === 'string' ? r : '')) : EMPTY_DRAFT.rules,
  };
}

export const loadDraft = (): ExamDraft => normalizeDraft(read<Partial<ExamDraft>>(DRAFT_KEY, {}));
export const saveDraft = (d: ExamDraft) => write(DRAFT_KEY, withoutImages(d));

/**
 * Limpa o rascunho local. É o que se faz ao começar do zero: a chave desaparece em
 * vez de ficar com um rascunho vazio, para o próximo arranque não voltar a perguntar.
 */
export const clearDraft = () => {
  try { localStorage.removeItem(DRAFT_KEY); } catch { /* quota / modo privado */ }
};

/**
 * O rascunho tem trabalho por guardar?
 *
 * Não chega olhar ao título e ao texto das questões. O rascunho guarda muitos mais
 * campos que o professor edita — escola, disciplina, tipo, classe, fase, duração,
 * série, ano letivo, instruções, observação, local, data e professor — e as próprias
 * questões têm cotação, tipo, opções de resposta e resposta esperada (`modelAnswer`).
 * Se o professor mexesse só num desses campos, o rascunho continuava a parecer vazio
 * e `clearDraft` apagava-o em silêncio no efeito de guardar: a perda de trabalho que
 * a #362 veio eliminar.
 *
 * Por isso a regra passa a ser «é diferente do rascunho de base?». Um rascunho
 * intocado (só com os valores por omissão de `EMPTY_DRAFT`) não vale um aviso nem
 * uma gravação; qualquer alteração — no cabeçalho, nas questões ou nas alíneas —
 * vale. Espaços em branco não contam como trabalho.
 */
export const draftHasContent = (d: ExamDraft): boolean =>
  d.title.trim() !== '' || d.items.some(itemHasContent) || headerHasContent(d);

/** O texto tem conteúdo real? Só espaços em branco não é trabalho. */
const filled = (value: string) => value.trim() !== '';

/**
 * Uma questão (ou alínea) tem trabalho quando tem texto, cotação, opções de resposta,
 * resposta esperada (`modelAnswer`) ou alíneas com conteúdo. O `kind` sozinho não
 * conta: um item normalizado traz sempre um tipo derivado, e mudar o tipo de uma
 * questão vazia e voltar atrás não deixa trabalho nenhum — o que o tipo traz a mais
 * são as opções, e essas contam.
 *
 * A marca `review` do OCR conta também: é o que diz ao professor «olha para isto».
 * Um item importado com essa marca e sem mais nada é o próprio trabalho da importação,
 * e apagá-lo em silêncio era perder exatamente o aviso que o OCR deixou.
 */
function itemHasContent(i: ExamDraft['items'][number]): boolean {
  if (filled(i.text) || filled(i.modelAnswer ?? '') || i.points !== '' || i.options.length > 0 || i.review === true || !!i.formulas?.length || !!i.blocks?.length) return true;
  return (i.items ?? []).some(itemHasContent);
}

/** Qualquer campo do cabeçalho diferente do rascunho de base é trabalho por guardar. */
function headerHasContent(d: ExamDraft): boolean {
  if (filled(d.schoolId) || filled(d.subject) || filled(d.variant) || filled(d.schoolYear)
    || filled(d.note) || filled(d.date) || filled(d.teacher) || d.duration !== '') return true;
  if (d.kind !== EMPTY_DRAFT.kind) return true;
  if (d.grade.trim() !== EMPTY_DRAFT.grade.trim()) return true;
  if (d.phase.trim() !== EMPTY_DRAFT.phase.trim()) return true;
  if (d.place.trim() !== EMPTY_DRAFT.place.trim()) return true;
  // As regras por omissão são duas e não vazias: apagar uma, escrever outra ou
  // acrescentar uma é trabalho. Comparam-se pelo comprimento e pelo texto limpo.
  if (d.rules.length !== EMPTY_DRAFT.rules.length) return true;
  return d.rules.some((rule, i) => rule.trim() !== EMPTY_DRAFT.rules[i].trim());
}

/** Lê uma imagem e reduz-a (máx. 320px) para caber no armazenamento local. */
export function imageToDataUri(file: File, max = 320): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k);
      c.height = Math.round(img.height * k);
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/png'));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Imagem inválida')); };
    img.src = url;
  });
}

export const slug = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
