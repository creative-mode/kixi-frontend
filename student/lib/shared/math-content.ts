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
  while (end !== -1 && (escapedAt(value, end) || (closing === '$' && value[end + 1] === '$'))) {
    end = value.indexOf(closing, end + closing.length);
  }
  if (end === -1 || end === start + opening.length) return null;
  return { start, end: end + closing.length, body: value.slice(start + opening.length, end), display: opening === '$$' || opening === '\\[', opening, closing };
}

function formulaFor(body: string, formulas: readonly MathFormula[]): MathFormula | undefined {
  const normalized = body.trim();
  return formulas.find((formula) => formula.raw.trim() === normalized || formula.latex?.trim() === normalized);
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
  try {
    const html = katex.renderToString(latex, {
      displayMode: display,
      output: 'htmlAndMathml',
      throwOnError: true,
      trust: false,
      maxExpand: 1000,
      maxSize: 20,
    });
    const source = formula ? ` title="${confidenceTitle}"` : '';
    return `<span class="kixi-math${display ? ' kixi-math-display' : ''}${needsReview ? ' kixi-math-review' : ''}"${source}>${html}${reviewLabel}</span>`;
  } catch {
    return `<span class="kixi-math-literal kixi-math-review"${formula ? ` title="${confidenceTitle}"` : ''}>${escapeHtml(literal)}<span class="kixi-math-review-label">Fórmula inválida — rever</span></span>`;
  }
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

export function renderMathHtml(text: string, formulas: readonly MathFormula[] = [], blocks?: readonly MathContentBlock[]): string {
  if (blocks?.length) {
    return blocks.map((block) => block.type === 'text'
      ? renderDelimitedText(block.text, formulas)
      : renderFormula(block.latex, block.raw, false, block)).join('');
  }
  return renderDelimitedText(text, formulas);
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
