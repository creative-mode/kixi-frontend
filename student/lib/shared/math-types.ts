/** A fórmula mantém o trecho que o OCR leu, a expressão renderizável e a confiança. */
export interface MathFormula {
  raw: string;
  latex?: string | null;
  confidence?: number | null;
  kind?: string | null;
  ocrConfidence?: number | null;
  layoutConfidence?: number | null;
}

export interface MathTextBlock {
  type: 'text';
  text: string;
}

export interface MathFormulaBlock extends MathFormula {
  type: 'formula';
}

export type MathContentBlock = MathTextBlock | MathFormulaBlock;

export interface MathContentFields {
  /** Texto OCR sem alterações, para comparação e auditoria. */
  rawText?: string;
  confidence?: number | null;
  formulas?: MathFormula[];
  blocks?: MathContentBlock[];
}

export const MATH_REVIEW_BELOW = 0.8;

export function mathNeedsReview(formulas?: readonly MathFormula[], blocks?: readonly MathContentBlock[]): boolean {
  const all = [...(formulas ?? []), ...(blocks ?? []).filter((block): block is MathFormulaBlock => block.type === 'formula')];
  return all.some((formula) => formula.kind === 'unrecognized'
    || !formula.latex?.trim()
    || [formula.confidence, formula.ocrConfidence, formula.layoutConfidence]
      .some((confidence) => typeof confidence === 'number' && confidence < MATH_REVIEW_BELOW));
}

const finiteConfidence = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

export function normalizeFormulas(value: unknown): MathFormula[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const formulas = value.flatMap((entry): MathFormula[] => {
    if (!entry || typeof entry !== 'object') return [];
    const formula = entry as Record<string, unknown>;
    if (typeof formula.raw !== 'string') return [];
    const confidence = finiteConfidence(formula.confidence);
    const ocrConfidence = finiteConfidence(formula.ocrConfidence);
    const layoutConfidence = finiteConfidence(formula.layoutConfidence);
    return [{
      raw: formula.raw,
      ...(typeof formula.latex === 'string' || formula.latex === null ? { latex: formula.latex } : {}),
      ...(confidence != null ? { confidence } : {}),
      ...(typeof formula.kind === 'string' || formula.kind === null ? { kind: formula.kind } : {}),
      ...(ocrConfidence != null ? { ocrConfidence } : {}),
      ...(layoutConfidence != null ? { layoutConfidence } : {}),
    }];
  });
  return formulas.length > 0 ? formulas : undefined;
}

export function normalizeMathBlocks(value: unknown): MathContentBlock[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const blocks = value.flatMap((entry): MathContentBlock[] => {
    if (!entry || typeof entry !== 'object') return [];
    const block = entry as Record<string, unknown>;
    if (block.type === 'text' && typeof block.text === 'string') return [{ type: 'text', text: block.text }];
    if (block.type !== 'formula' || typeof block.raw !== 'string') return [];
    const confidence = finiteConfidence(block.confidence);
    const ocrConfidence = finiteConfidence(block.ocrConfidence);
    const layoutConfidence = finiteConfidence(block.layoutConfidence);
    return [{
      type: 'formula',
      raw: block.raw,
      ...(typeof block.latex === 'string' || block.latex === null ? { latex: block.latex } : {}),
      ...(confidence != null ? { confidence } : {}),
      ...(typeof block.kind === 'string' || block.kind === null ? { kind: block.kind } : {}),
      ...(ocrConfidence != null ? { ocrConfidence } : {}),
      ...(layoutConfidence != null ? { layoutConfidence } : {}),
    }];
  });
  return blocks.length > 0 ? blocks : undefined;
}

export function mathContentFields(input: object): MathContentFields {
  const value = input as Record<string, unknown>;
  const rawText = typeof value.rawText === 'string' ? value.rawText : undefined;
  const confidence = finiteConfidence(value.confidence ?? value.ocrConfidence);
  const formulas = normalizeFormulas(value.formulas);
  const blocks = normalizeMathBlocks(value.blocks);
  return {
    ...(rawText !== undefined ? { rawText } : {}),
    ...(confidence != null ? { confidence } : {}),
    ...(formulas ? { formulas } : {}),
    ...(blocks ? { blocks } : {}),
  };
}

function escapedAt(value: string, index: number): boolean {
  let count = 0;
  for (let i = index - 1; i >= 0 && value[i] === '\\'; i -= 1) count += 1;
  return count % 2 === 1;
}

function mathSpanAt(value: string, index: number): { start: number; end: number; bodyStart: number; bodyEnd: number } | null {
  for (let i = 0; i <= index; i += 1) {
    const opening = value.startsWith('$$', i) ? '$$' : value.startsWith('\\[', i) ? '\\[' : value.startsWith('\\(', i) ? '\\(' : value[i] === '$' && !value.startsWith('$$', i) ? '$' : null;
    if (!opening || escapedAt(value, i)) continue;
    const closing = opening === '$$' ? '$$' : opening === '\\[' ? '\\]' : opening === '\\(' ? '\\)' : '$';
    let end = value.indexOf(closing, i + opening.length);
    while (end !== -1 && (escapedAt(value, end) || (closing === '$' && value[end + 1] === '$'))) end = value.indexOf(closing, end + closing.length);
    if (end < 0) continue;
    if (index >= i && index <= end + closing.length - 1) return { start: i, end: end + closing.length, bodyStart: i + opening.length, bodyEnd: end };
    i = end + closing.length - 1;
  }
  return null;
}

/** Texto que a API actual consegue guardar: os blocos tornam-se delimitadores LaTeX no campo `text`. */
export function serializeMathText(text: string, formulas: readonly MathFormula[] = [], blocks?: readonly MathContentBlock[]): string {
  if (blocks?.length) {
    return blocks.map((block) => block.type === 'text' ? block.text : block.latex?.trim() && block.kind !== 'unrecognized'
      ? `$${block.latex}$` : block.raw).join('');
  }
  let result = text;
  for (const formula of formulas) {
    if (!formula.raw || !formula.latex?.trim() || formula.kind === 'unrecognized') continue;
    let cursor = 0;
    let index = result.indexOf(formula.raw, cursor);
    while (index >= 0) {
      const span = mathSpanAt(result, index);
      if (span) {
        const body = result.slice(span.bodyStart, span.bodyEnd);
        if (body.trim() === formula.raw.trim()) {
          result = `${result.slice(0, span.bodyStart)}${formula.latex}${result.slice(span.bodyEnd)}`;
          cursor = span.bodyStart + formula.latex.length;
        } else cursor = span.end;
      } else {
        result = `${result.slice(0, index)}$${formula.latex}$${result.slice(index + formula.raw.length)}`;
        cursor = index + formula.latex.length + 2;
      }
      index = result.indexOf(formula.raw, cursor);
    }
  }
  return result;
}
