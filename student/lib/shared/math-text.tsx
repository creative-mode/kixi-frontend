import type { MathContentBlock, MathFormula } from './math-types.ts';
import { renderMathMarkup, renderStandaloneMathMarkup } from './math-content.ts';
import { normalizeMathMarkdown } from './math-normalize.ts';

/**
 * O único sítio onde texto com matemática passa para o DOM (#754): folha da prova, resultado,
 * publicações, comentários e tutor. O KaTeX devolve MathML + HTML, por isso um leitor de ecrã lê
 * a fórmula em vez dos `$…$`; fórmulas inválidas ficam como texto escapado.
 */
export function MathText({ text, formulas, blocks, className, normalize = false, mode = 'text', display = false }: {
  text: string;
  formulas?: readonly MathFormula[];
  blocks?: readonly MathContentBlock[];
  className?: string;
  /** Passa o texto por `normalizeMathMarkdown` antes de renderizar (publicações, comentários, tutor). */
  normalize?: boolean;
  /** `formula`: o valor inteiro é LaTeX; `text`: o valor tem fórmulas misturadas com texto. */
  mode?: 'text' | 'formula';
  display?: boolean;
}) {
  if (mode === 'formula') {
    return <span className={className} dangerouslySetInnerHTML={renderStandaloneMathMarkup(text, display)} />;
  }
  const value = normalize ? normalizeMathMarkdown(text) : text;
  return <span className={className} dangerouslySetInnerHTML={renderMathMarkup(value, formulas, blocks)} />;
}
