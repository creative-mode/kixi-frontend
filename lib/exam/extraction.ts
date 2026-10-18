/**
 * A extração do OCR (`POST /api/v1/ocr/extract/exam`) convertida em rascunho do construtor.
 *
 * Pura e sem React: é a fronteira entre o que o OCR acha que leu e o que o professor vai rever,
 * por isso cada decisão aqui está testada. Importar **não persiste nada**: devolve um rascunho e
 * as notas que explicam o que ficou por decidir (disciplina que não existe, cotação em falta…).
 *
 * O tipo que o OCR infere (`dissertativa`, `multipla_escolha`, `verdadeiro_falso`, `composta`) mapeia
 * para o do construtor; as alíneas vêm em `subitems_content`. O gabarito nunca vem do OCR: um
 * verdadeiro/falso fica com as duas opções e nenhuma marcada, para o professor decidir.
 */
import { labelAt, trueFalseOptions, type DraftImage, type DraftItem, type DraftOption, type DraftQuestion, type LeafKind } from './draft.ts';
import { KINDS, type ExamDraft } from './schools.ts';

export interface ExtractionOption { option_label?: string | null; option_text?: string | null }
export interface ExtractionSubitem { label?: string | null; text?: string | null; cotacao?: number | null; type?: string | null }
export interface ExtractionQuestion {
  number?: string | null;
  text?: string | null;
  type?: string | null;
  cotacao?: number | null;
  confidence?: number | null;
  options?: ExtractionOption[] | null;
  subitems?: string[] | null;
  subitems_content?: ExtractionSubitem[] | null;
}
/** A region the OCR found on the page. `region` is `questao_<n>` for a figure, table or formula of question n,
 *  and `cabecalho`/`rodape` for the header and the signature (which are not shown in the builder). */
export interface ExtractionImage {
  region?: string | null;
  description?: string | null;
  kind?: string | null;
  /** The crop as a `data:image/png;base64,...` URL; absent when it could not be cut. */
  data_url?: string | null;
}
export interface ExtractionWarning { code?: string | null; field?: string | null; confidence?: number | null; message?: string | null }
export interface ExamExtraction {
  exam_type?: string | null;
  duration_minutes?: number | null;
  variant?: string | null;
  title?: string | null;
  instructions?: string | null;
  school_year_start?: number | null;
  school_year_end?: number | null;
  class_grade?: string | null;
  course_name?: string | null;
  subject_name?: string | null;
  total_max_score?: number | null;
  needs_review?: boolean | null;
  overall_confidence?: number | null;
  warnings?: ExtractionWarning[] | null;
  questions?: ExtractionQuestion[] | null;
  images_to_upload?: ExtractionImage[] | null;
}

export interface ExtractionContext {
  /** Os nomes das disciplinas da escola escolhida: só nelas se pode classificar a prova. */
  subjects: string[];
}

export interface ImportedDraft {
  /** O que muda no cabeçalho do rascunho. Só leva o que a extração trouxe. */
  patch: Partial<ExamDraft>;
  items: DraftQuestion[];
  /** Frases para o professor: o que foi lido, o que ficou por decidir. */
  notes: string[];
  /** Quantas folhas (questões ou alíneas) ficaram marcadas para rever. */
  reviewCount: number;
}

/** Abaixo disto o motor não estava seguro e a questão fica marcada para rever. */
export const REVIEW_BELOW = 0.8;

const FIELD_NAMES: Record<string, string> = {
  subjectName: 'a disciplina', subject: 'a disciplina', durationMinutes: 'a duração', title: 'o título',
  examType: 'o tipo de prova', classGrade: 'a classe', variant: 'a série', schoolYear: 'o ano letivo', totalMaxScore: 'a cotação total',
};

const norm = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const SMALL_WORDS = new Set(['e', 'de', 'da', 'do', 'das', 'dos', 'a', 'o', 'em', 'para']);
const initials = (value: string) => norm(value).split(' ').filter((w) => w && !SMALL_WORDS.has(w)).map((w) => w[0]).join('');

/** A disciplina da escola a que o nome extraído corresponde: igual sem acentos nem maiúsculas, ou a sigla
 *  de uma e o nome completo da outra (OGI ↔ Organização e Gestão Industrial). `null` quando nenhuma serve. */
export function matchSubject(extracted: string | null | undefined, subjects: readonly string[]): string | null {
  const wanted = norm(extracted ?? '');
  if (!wanted) return null;
  const exact = subjects.find((s) => norm(s) === wanted);
  if (exact) return exact;
  const compact = wanted.replace(/ /g, '');
  const byAcronym = subjects.find((s) => {
    const own = norm(s).replace(/ /g, '');
    return (compact.length >= 2 && compact.length <= 6 && initials(s) === compact) || (own.length >= 2 && own.length <= 6 && initials(extracted ?? '') === own);
  });
  return byAcronym ?? null;
}

const leafKind = (type: string | null | undefined, fallback: LeafKind): LeafKind => {
  const t = (type ?? '').toLowerCase();
  if (t === 'verdadeiro_falso') return 'true_false';
  if (t === 'multipla_escolha') return 'multiple_choice';
  if (t === 'dissertativa') return 'open';
  return fallback;
};

/** O «( )» que fica no fim de uma afirmação de verdadeiro/falso não faz parte do texto. */
const clean = (text: string | null | undefined) => (text ?? '').replace(/\s*\(\s*\)\s*\.?\s*$/, '').replace(/\s+/g, ' ').trim();

function optionsFrom(raw: ExtractionOption[] | null | undefined): DraftOption[] {
  const used = new Set<string>();
  return (raw ?? [])
    .map((o, i) => ({ label: (o.option_label ?? '').trim().charAt(0).toUpperCase() || labelAt(i), text: (o.option_text ?? '').trim() }))
    .filter((o) => o.text)
    .map((o, i) => {
      // Um rótulo repetido é uma violação de UNIQUE no backend: o segundo recebe o próximo livre.
      let label = o.label;
      for (let n = 0; used.has(label); n += 1) label = labelAt(n);
      used.add(label);
      return { label: label || labelAt(i), text: o.text, correct: false };
    });
}

const points = (cotacao: number | null | undefined): number | '' => (typeof cotacao === 'number' && cotacao > 0 ? cotacao : '');

function itemFrom(sub: ExtractionSubitem, fallback: LeafKind, review: boolean): DraftItem {
  const kind = leafKind(sub.type, fallback);
  return {
    text: clean(sub.text),
    points: points(sub.cotacao),
    kind,
    options: kind === 'true_false' ? trueFalseOptions() : kind === 'multiple_choice' ? [{ label: 'A', text: '', correct: false }, { label: 'B', text: '', correct: false }] : [],
    ...(review ? { review: true } : {}),
  };
}

function questionFrom(q: ExtractionQuestion): { question: DraftQuestion; review: number } {
  const type = (q.type ?? '').toLowerCase();
  const review = typeof q.confidence === 'number' && q.confidence < REVIEW_BELOW;
  const subs = (q.subitems_content ?? []).filter((s) => clean(s.text));
  const text = (q.text ?? '').replace(/\s+/g, ' ').trim();

  if (subs.length > 0 && (type === 'verdadeiro_falso' || type === 'composta' || type === 'dissertativa' || type === '')) {
    const fallback: LeafKind = type === 'verdadeiro_falso' ? 'true_false' : 'open';
    const items = subs.map((s) => itemFrom(s, fallback, review));
    return { question: { text, points: '', options: [], kind: 'group', items, ...(review ? { review: true } : {}) }, review: review ? items.length : 0 };
  }
  if (type === 'verdadeiro_falso') {
    return { question: { text: clean(q.text) || text, points: points(q.cotacao), options: trueFalseOptions(), kind: 'true_false', ...(review ? { review: true } : {}) }, review: review ? 1 : 0 };
  }
  const options = type === 'multipla_escolha' ? optionsFrom(q.options) : [];
  if (options.length > 0) {
    return { question: { text, points: points(q.cotacao), options, kind: 'multiple_choice', ...(review ? { review: true } : {}) }, review: review ? 1 : 0 };
  }
  return { question: { text, points: points(q.cotacao), options: [], kind: 'open', ...(review ? { review: true } : {}) }, review: review ? 1 : 0 };
}

const FIGURE_NAMES: Record<string, string> = { figure: 'Figura', table: 'Tabela', formula: 'Fórmula' };

/** The figures of one question: the crops the OCR cut out under it, in the order they have on the page. */
function imagesOf(number: string | null | undefined, regions: ExtractionImage[] | null | undefined): DraftImage[] {
  const wanted = (number ?? '').trim();
  if (!wanted) return [];
  return (regions ?? [])
    .filter((r) => r.region === `questao_${wanted}` && typeof r.data_url === 'string' && r.data_url.startsWith('data:image/'))
    .map((r, i) => ({
      dataUrl: r.data_url as string,
      caption: (r.description ?? '').trim() || `${FIGURE_NAMES[r.kind ?? 'figure'] ?? 'Figura'} ${i + 1}`,
      ...(r.kind ? { kind: r.kind } : {}),
    }));
}

function examKind(type: string | null | undefined): string | null {
  const t = norm(type ?? '');
  if (!t) return null;
  const hit = (['exame', 'teste', 'trabalho', 'prova'] as const).find((k) => t.includes(k));
  return hit ? KINDS.find((k) => norm(k).startsWith(hit)) ?? null : null;
}

function gradeLabel(grade: string | null | undefined): string | null {
  const g = (grade ?? '').trim();
  if (!g) return null;
  return /^\d+$/.test(g) ? `${g}ª Classe` : g;
}

/**
 * O rascunho a partir da extração. Não toca em nada que a extração não trouxe, e devolve as notas
 * que o ecrã mostra por cima do editor.
 */
export function draftFromExtraction(extraction: ExamExtraction, ctx: ExtractionContext): ImportedDraft {
  const patch: Partial<ExamDraft> = {};
  const notes: string[] = [];

  const title = (extraction.title ?? '').trim();
  if (title) patch.title = title;
  const kind = examKind(extraction.exam_type);
  if (kind) patch.kind = kind;
  const grade = gradeLabel(extraction.class_grade);
  if (grade) patch.grade = grade;
  if (typeof extraction.duration_minutes === 'number' && extraction.duration_minutes > 0) patch.duration = Math.round(extraction.duration_minutes);
  const variant = (extraction.variant ?? '').trim();
  if (variant) patch.variant = variant;
  if (extraction.school_year_start && extraction.school_year_end) patch.schoolYear = `${extraction.school_year_start}/${extraction.school_year_end}`;
  const rules = (extraction.instructions ?? '').split(/\r?\n/).map((r) => r.trim()).filter(Boolean);
  if (rules.length > 0) patch.rules = rules;

  const name = (extraction.subject_name ?? '').trim();
  const subject = matchSubject(name, ctx.subjects);
  if (subject) patch.subject = subject;
  else if (name) {
    // A disciplina que o rascunho tinha não é a desta prova: deixa-se por escolher em vez de a manter calada.
    patch.subject = '';
    notes.push(`A disciplina «${name}» não existe nesta escola. Escolha-a na lista ou peça a um administrador que a associe à escola.`);
  } else notes.push('A prova não indica a disciplina. Escolha-a na lista.');

  const kept = (extraction.questions ?? []).filter((q) => (q.text ?? '').trim() || (q.subitems_content ?? []).length > 0);
  const built = kept.map(questionFrom);
  const items = built.map((b, i) => {
    const images = imagesOf(kept[i].number, extraction.images_to_upload);
    return images.length > 0 ? { ...b.question, images } : b.question;
  });
  const figureCount = items.reduce((n, q) => n + (q.images?.length ?? 0), 0);
  const reviewCount = built.reduce((n, b) => n + b.review, 0);

  if (items.length === 0) notes.push('Não foi possível ler questões nesta imagem. Tente uma foto mais nítida e de frente, ou escreva as questões à mão.');
  const codes = new Set((extraction.warnings ?? []).map((w) => (w.code ?? '').toUpperCase()));
  const allUnscored = items.length > 0 && items.every((q) => (q.kind === 'group' ? (q.items ?? []).every((i) => i.points === '') : q.points === ''));
  if (codes.has('NO_COTACAO') || allUnscored) {
    notes.push('A prova não traz cotação. Use «Distribuir 20 valores» ou preencha a cotação de cada questão.');
  }
  for (const w of extraction.warnings ?? []) {
    if ((w.code ?? '').toUpperCase() !== 'LOW_CONFIDENCE' || !w.field) continue;
    if (w.field === 'subjectName' || w.field === 'subject') continue; // já tratada acima
    notes.push(`O motor ficou inseguro com ${FIELD_NAMES[w.field] ?? `«${w.field}»`}. Confirme-o.`);
  }
  if (codes.has('IMAGE_QUALITY')) {
    // #263: o próprio pré-processamento já apontou a razão (desfocada, escura, queimada); a
    // mensagem do motor é mais específica do que o genérico "não li questões" acima, por isso
    // substitui-o em vez de se somar a ele.
    const quality = (extraction.warnings ?? []).find((w) => (w.code ?? '').toUpperCase() === 'IMAGE_QUALITY');
    const genericIndex = notes.indexOf('Não foi possível ler questões nesta imagem. Tente uma foto mais nítida e de frente, ou escreva as questões à mão.');
    if (genericIndex !== -1) notes.splice(genericIndex, 1);
    notes.unshift(quality?.message ?? 'A imagem pode estar ilegível. Tente fotografar de novo com mais luz e sem tremer.');
  }
  if (figureCount > 0) notes.push(`${figureCount} figura(s), tabela(s) ou fórmula(s) ficaram ligadas às questões. Confirme se cada uma está na questão certa; pode retirá-la.`);
  if (reviewCount > 0) notes.push(`${reviewCount} questão(ões) ficaram marcadas «rever»: o texto pode ter erros de leitura.`);
  if (items.some((q) => q.kind === 'true_false' || (q.items ?? []).some((i) => i.kind === 'true_false'))) {
    notes.push('Marque Verdadeiro ou Falso em cada afirmação: o OCR não adivinha o gabarito.');
  }
  return { patch, items, notes, reviewCount };
}
