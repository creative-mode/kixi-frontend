import type { MathContentBlock, MathFormula } from './math-types.ts';
import { renderMathHtml } from './math-content.ts';

export function MathText({ text, formulas, blocks, className }: {
  text: string;
  formulas?: readonly MathFormula[];
  blocks?: readonly MathContentBlock[];
  className?: string;
}) {
  return <span className={className} dangerouslySetInnerHTML={{ __html: renderMathHtml(text, formulas, blocks) }} />;
}
