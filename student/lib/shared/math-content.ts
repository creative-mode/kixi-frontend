import katex from 'katex';
import { MATH_REVIEW_BELOW, serializeMathText, type MathContentBlock, type MathFormula } from './math-types.ts';
export { serializeMathText } from './math-types.ts';

const escapeHtml = (value: string) => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

interface MathToken { start: number; end: number; body: string; display: boolean; opening: string; closing: string }

function escapedAt(value: string, index: number): boolean {
  let slashes = 0;
  for (let i = index - 1; i >= 0 && value[i] === '\\'; i -= 1) slashes += 1;
  return slashes % 2 === 1;
}

function tokenAt(value: string, start: number): MathToken | null {
  const opening = value.startsWith('$$', start) ? '$$'
    : value.startsWith('\\[', start) ? '\\['
    : value.startsWith('\\(', start) ? '\\('
    : value[start] === '$' && !value.startsWith('$$', start) ? '$' : null;
  if (!opening || escapedAt(value, start)) return null;
  const closing = opening === '$$' ? '$$' : opening === '\\[' ? '\\]' : opening === '\\(' ? '\\)' : '$';
  let end = value.indexOf(closing, start + opening.length);
  while (end !== -1 && escapedAt(value, end)) {
    end = value.indexOf(closing, end + closing.length);
  }
  if (end === -1 || end === start + opening.length) return null;
  return { start, end: end + closing.length, body: value.slice(start + opening.length, end), display: opening === '$$' || opening === '\\[', opening, closing };
}

function formulaFor(body: string, formulas: readonly MathFormula[]): MathFormula | undefined {
  const normalized = body.trim();
  return formulas.find((formula) => formula.raw.trim() === normalized || formula.latex?.trim() === normalized);
}

/**
 * O KaTeX é determinístico: a mesma fórmula devolve o mesmo HTML. A cache evita-o por cada
 * fotograma do tutor a escrever (o texto chega por partes e é re-renderizado) e por cada
 * publicação que reaparece no feed (#754).
 */
const KATEX_CACHE = new Map<string, string>();
const KATEX_CACHE_LIMIT = 500;

function renderKatex(latex: string, display: boolean): string | null {
  const key = `${display ? 'D' : 'I'}:${latex}`;
  const cached = KATEX_CACHE.get(key);
  if (cached) return cached;
  try {
    const html = katex.renderToString(latex, {
      displayMode: display,
      output: 'htmlAndMathml',
      throwOnError: true,
      trust: false,
      maxExpand: 1000,
      maxSize: 20,
    });
    if (KATEX_CACHE.size >= KATEX_CACHE_LIMIT) KATEX_CACHE.clear();
    KATEX_CACHE.set(key, html);
    return html;
  } catch {
    return null;
  }
}

function renderFormula(latex: string | null | undefined, literal: string, display: boolean, formula?: MathFormula): string {
  const needsReview = formula?.kind === 'unrecognized' || !latex?.trim()
    || [formula?.confidence, formula?.ocrConfidence, formula?.layoutConfidence]
      .some((confidence) => typeof confidence === 'number' && confidence < MATH_REVIEW_BELOW);
  const reviewLabel = needsReview ? '<span class="kixi-math-review-label">Fórmula a rever</span>' : '';
  const confidenceTitle = formula ? [
    `OCR: ${escapeHtml(formula.raw)}`,
    ...([['confiança', formula.confidence], ['OCR', formula.ocrConfidence], ['layout', formula.layoutConfidence]] as const)
      .flatMap(([name, confidence]) => typeof confidence === 'number'
        ? [`${name} ${Math.round(confidence * 100)}%`]
        : []),
  ].join(' · ') : '';
  if (!latex?.trim() || formula?.kind === 'unrecognized') {
    return `<span class="kixi-math-literal${needsReview ? ' kixi-math-review' : ''}"${formula ? ` title="${confidenceTitle}"` : ''}>${escapeHtml(literal)}${reviewLabel}</span>`;
  }
  const html = renderKatex(latex, display);
  if (html === null) {
    return `<span class="kixi-math-literal kixi-math-review"${formula ? ` title="${confidenceTitle}"` : ''}>${escapeHtml(literal)}<span class="kixi-math-review-label">Fórmula inválida — rever</span></span>`;
  }
  const source = formula ? ` title="${confidenceTitle}"` : '';
  return `<span class="kixi-math${display ? ' kixi-math-display' : ''}${needsReview ? ' kixi-math-review' : ''}"${source}>${html}${reviewLabel}</span>`;
}

function renderDelimitedText(text: string, formulas: readonly MathFormula[]): string {
  const value = serializeMathText(text, formulas);
  let html = '';
  let cursor = 0;
  for (let i = 0; i < value.length;) {
    const token = tokenAt(value, i);
    if (!token) { i += 1; continue; }
    html += escapeHtml(value.slice(cursor, token.start));
    const formula = formulaFor(token.body, formulas);
    const literal = value.slice(token.start, token.end);
    html += renderFormula(formula?.latex ?? token.body, literal, token.display, formula);
    cursor = token.end;
    i = token.end;
  }
  return html + escapeHtml(value.slice(cursor));
}

export interface MathSegment {
  /** Texto cru deste pedaço, delimitadores incluídos. */
  text: string;
  start: number;
  end: number;
  /** Presente só nas fórmulas: o LaTeX sem delimitadores e se é destacada. */
  formula: { latex: string; display: boolean } | null;
}

/**
 * Reparte o texto em pedaços de texto e de fórmula, lendo os delimitadores como o desenho:
 * quem edita sabe assim a que intervalo do texto pertence cada fórmula desenhada.
 */
export function splitMathText(value: string): MathSegment[] {
  const segments: MathSegment[] = [];
  let cursor = 0;
  for (let i = 0; i < value.length;) {
    const token = tokenAt(value, i);
    if (!token) { i += 1; continue; }
    if (token.start > cursor) {
      segments.push({ text: value.slice(cursor, token.start), start: cursor, end: token.start, formula: null });
    }
    segments.push({
      text: value.slice(token.start, token.end),
      start: token.start,
      end: token.end,
      formula: { latex: token.body.trim(), display: token.display },
    });
    cursor = token.end;
    i = token.end;
  }
  if (cursor < value.length) segments.push({ text: value.slice(cursor), start: cursor, end: value.length, formula: null });
  return segments;
}

export function renderMathHtml(text: string, formulas: readonly MathFormula[] = [], blocks?: readonly MathContentBlock[]): string {
  if (blocks?.length) {
    return blocks.map((block) => block.type === 'text'
      ? renderDelimitedText(block.text, formulas)
      : renderFormula(block.latex, block.raw, false, block)).join('');
  }
  return renderDelimitedText(text, formulas);
}

const DELIMITED = /^\s*(?:\$\$?|\\\[|\\\()([\s\S]*?)(?:\$\$?|\\\]|\\\))\s*$/;

/** O LaTeX de um bloco de fórmula, sem os delimitadores que o aluno possa ter escrito. */
export function standaloneLatex(value: string): string {
  const match = DELIMITED.exec(value);
  return (match ? match[1] : value).trim();
}

/**
 * Um valor inteiro é uma fórmula, não texto com fórmulas: o bloco `formula` do compositor e os `Inline`
 * do tutor. Se não compilar fica o texto tal como veio — publicações antigas não ganham um aviso.
 */
export function renderStandaloneMathHtml(value: string, display: boolean): string {
  const latex = standaloneLatex(value);
  if (!latex) return '';
  const html = renderKatex(latex, display);
  if (html === null) {
    return `<span class="kixi-math-literal">${escapeHtml(latex)}</span>`;
  }
  return `<span class="kixi-math${display ? ' kixi-math-display' : ''}">${html}</span>`;
}

/** A fronteira HTML de um valor inteiro, como `renderMathMarkup` para o texto com fórmulas. */
export function renderStandaloneMathMarkup(value: string, display: boolean): { __html: string } {
  return { __html: renderStandaloneMathHtml(value, display) };
}

/** The single audited boundary between escaped/KaTeX output and React's HTML sink. */
export function renderMathMarkup(
  text: string,
  formulas: readonly MathFormula[] = [],
  blocks?: readonly MathContentBlock[],
): { __html: string } {
  return { __html: renderMathHtml(text, formulas, blocks) };
}

export function hasMathContent(text: string, formulas?: readonly MathFormula[], blocks?: readonly MathContentBlock[]): boolean {
  return !!formulas?.length || !!blocks?.some((block) => block.type === 'formula') || /\$\$|\\\[|\\\(|(?<!\\)\$/.test(text);
}
