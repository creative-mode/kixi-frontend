import assert from 'node:assert/strict';
import test from 'node:test';
import { hasMathContent, renderMathHtml, renderMathMarkup, serializeMathText } from './math-content.ts';

test('renderiza delimitadores inline, display e parênteses LaTeX', () => {
  const html = renderMathHtml('Força $F=ma$, energia $$E=mc^2$$ e vetor \\(\\vec{x}\\).');
  assert.equal((html.match(/class="kixi-math/g) ?? []).length, 3);
  assert.match(html, /katex-display/);
  assert.match(html, /Força /);
});

test('fórmula inválida e comando não confiável ficam como texto literal escapado', () => {
  const invalid = renderMathHtml('Antes $\\notacommand{x}$ depois');
  assert.match(invalid, /Antes <span class="kixi-math-literal kixi-math-review"/);
  assert.ok(invalid.includes('$\\notacommand{x}$'));
  assert.match(invalid, /depois$/);
  const untrusted = renderMathHtml('<img src=x onerror=alert(1)> $\\href{javascript:alert(1)}{x}$');
  assert.doesNotMatch(untrusted, /<img|href="javascript:/);
  assert.match(untrusted, /&lt;img/);
});

test('a fronteira HTML do React só recebe conteúdo escapado pelo renderizador matemático', () => {
  const markup = renderMathMarkup('<script>alert(1)</script> $x^2$');
  assert.doesNotMatch(markup.__html, /<script>/);
  assert.match(markup.__html, /&lt;script&gt;/);
  assert.match(markup.__html, /class="kixi-math/);
});

test('segmentos reconhecidos usam LaTeX e conservam o trecho OCR para auditoria', () => {
  const formulas = [{ raw: 'Bmaxe-2t', latex: 'B_{\\max}e^{-2t}', confidence: 0.62, kind: 'formula' }];
  const html = renderMathHtml('Campo: Bmaxe-2t', formulas);
  assert.match(html, /katex/);
  assert.match(html, /Fórmula a rever/);
  assert.match(html, /kixi-math-review/);
  assert.match(html, /title="OCR: Bmaxe-2t · confiança 62%"/);
  assert.equal(serializeMathText('Campo: Bmaxe-2t', formulas), 'Campo: $B_{\\max}e^{-2t}$');
  assert.equal(serializeMathText('Campo: $Bmaxe-2t$', formulas), 'Campo: $B_{\\max}e^{-2t}$');
  assert.equal(hasMathContent('Campo: Bmaxe-2t', formulas), true);
});

test('baixa confiança da leitura original exige revisão mesmo com LaTeX plausível', () => {
  const html = renderMathHtml('x2', [{
    raw: 'x2', latex: 'x^2', confidence: 0.96, ocrConfidence: 0.43, kind: 'formula',
  }]);
  assert.match(html, /kixi-math-review/);
  assert.match(html, /Fórmula a rever/);
  assert.match(html, /OCR 43%/);
});

test('blocos tipados seguem a ordem e texto bruto/confiança sobrevivem à normalização', () => {
  const blocks = [
    { type: 'text' as const, text: 'Calcule ' },
    { type: 'formula' as const, raw: '2x', latex: '2x', confidence: 0.98, kind: 'formula' },
    { type: 'text' as const, text: ' agora.' },
  ];
  const html = renderMathHtml('', [], blocks);
  assert.match(html, /^Calcule <span class="kixi-math/);
  assert.match(html, / agora\.$/);
  assert.equal(serializeMathText('', [], blocks), 'Calcule $2x$ agora.');

});

test('fórmula inválida preserva o delimitador e recebe marca de revisão', () => {
  const html = renderMathHtml('Valor $\\notacommand{x}$', [{ raw: '\\notacommand{x}', latex: '\\notacommand{x}', confidence: 0.95, kind: 'formula' }]);
  assert.match(html, /Valor <span class="kixi-math-literal kixi-math-review"/);
  assert.ok(html.includes('$\\notacommand{x}$'));
  assert.match(html, /Fórmula inválida — rever/);
});
