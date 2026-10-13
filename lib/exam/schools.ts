import { labelsFor, type DraftQuestion } from './draft';

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
  rules: string[];
  note: string;
  place: string;
  date: string;
  teacher: string;
}

export const KINDS = ['Trabalho prático', 'Teste', 'Prova', 'Exame'] as const;

export const SEED_SCHOOLS: School[] = [
  {
    id: 'itel',
    name: 'Instituto de Telecomunicações',
    logo: '/manager/exam/itel.png',
    subjects: ['TLP e SI', 'Redes de Computadores', 'Sistemas Operativos', 'Programação'],
  },
];

export const EMPTY_DRAFT: ExamDraft = {
  schoolId: 'itel',
  subject: '',
  kind: 'Trabalho prático',
  grade: '12ª Classe',
  phase: '1ª Fase',
  items: [{ text: '', points: '', options: [] }],
  rules: ['O trabalho deve ser realizado em grupo.', 'Cotação: de 0 a 20 valores.'],
  note: '',
  place: 'Luanda',
  date: '',
  teacher: '',
};

const SCHOOLS_KEY = 'kixi-exam-schools';
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

export const loadSchools = () => {
  const saved = read<School[]>(SCHOOLS_KEY, []);
  const ids = new Set(saved.map((s) => s.id));
  return [...SEED_SCHOOLS.filter((s) => !ids.has(s.id)), ...saved];
};
export const saveSchools = (s: School[]) => write(SCHOOLS_KEY, s);

/**
 * A pergunta como o app a guarda, seja ela de que versão do rascunho veio.
 *
 * O rascunho vive em localStorage e a forma mudou quando as opções entraram: um
 * `items` guardado antes disso traz `{ text, points }` e não tem `options`. Um merge
 * ingénuo deixa esse campo a `undefined` e o editor rebenta com `undefined.map` —
 * com a folha de rascunho de um professor a perder-se no primeiro clique depois da
 * actualização. Cada campo é normalizado aqui, e o que não se reconhece perde-se.
 */
function normalizeItem(raw: Partial<ExamItem> | undefined): ExamItem {
  const rawOptions = Array.isArray(raw?.options) ? raw.options : [];
  // Só as opções sem rótulo recebem um, e `labelsFor` salta os que já estão
  // tomados: um rascunho meio etiquetado não pode dar duas opções com o mesmo
  // rótulo, que é uma violação do `UNIQUE (question_id, option_label)`.
  const labels = labelsFor(rawOptions);
  const options = rawOptions.map((o, i) => ({
    label: labels[i],
    text: typeof o?.text === 'string' ? o.text : '',
    correct: o?.correct === true,
  }));
  return {
    text: typeof raw?.text === 'string' ? raw.text : '',
    points: typeof raw?.points === 'number' ? raw.points : '',
    options,
  };
}

export const loadDraft = (): ExamDraft => {
  const saved = read<Partial<ExamDraft>>(DRAFT_KEY, {});
  return {
    ...EMPTY_DRAFT,
    ...saved,
    items: Array.isArray(saved.items) && saved.items.length > 0 ? saved.items.map(normalizeItem) : EMPTY_DRAFT.items.map(normalizeItem),
    rules: Array.isArray(saved.rules) ? saved.rules.map((r) => (typeof r === 'string' ? r : '')) : EMPTY_DRAFT.rules,
  };
};
export const saveDraft = (d: ExamDraft) => write(DRAFT_KEY, d);

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
