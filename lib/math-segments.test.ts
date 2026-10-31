// Pedaços de texto e de fórmula do editor de enunciados (#531): node --test lib/math-segments.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { splitMathText } from '../student/lib/shared/math-content.ts';

test('texto sem fórmulas é um só pedaço', () => {
  assert.deepEqual(splitMathText('Calcule o valor.'), [{ text: 'Calcule o valor.', start: 0, end: 16, formula: null }]);
  assert.deepEqual(splitMathText(''), []);
});

test('cada fórmula sabe o intervalo que ocupa no texto', () => {
  const value = 'Sendo $x^{2}$ e $\\frac{a}{b}$, calcule.';
  const formulas = splitMathText(value).filter((s) => s.formula);
  assert.equal(formulas.length, 2);
  assert.equal(value.slice(formulas[0].start, formulas[0].end), '$x^{2}$');
  assert.deepEqual(formulas[0].formula, { latex: 'x^{2}', display: false });
  assert.equal(value.slice(formulas[1].start, formulas[1].end), '$\\frac{a}{b}$');
  assert.equal(formulas[1].formula?.latex, '\\frac{a}{b}');
});

test('substituir o intervalo de uma fórmula não toca no resto do texto', () => {
  const value = 'A $x$ e B $y$ fim';
  const second = splitMathText(value).filter((s) => s.formula)[1];
  assert.equal(`${value.slice(0, second.start)}$z$${value.slice(second.end)}`, 'A $x$ e B $z$ fim');
});

test('as fórmulas destacadas, nas duas notações, e sem espaços à volta do LaTeX', () => {
  const [a, , b] = splitMathText('$$\nx+1\n$$ e \\[y\\]');
  assert.deepEqual(a.formula, { latex: 'x+1', display: true });
  assert.deepEqual(b.formula, { latex: 'y', display: true });
});

test('os pedaços voltam a dar exatamente o texto original', () => {
  const value = 'a $b$ c $$d$$ e \\(f\\) g';
  assert.equal(splitMathText(value).map((s) => s.text).join(''), value);
});

test('um cifrão escapado ou sem par não é fórmula', () => {
  assert.equal(splitMathText('custa \\$5 e $ sozinho').filter((s) => s.formula).length, 0);
});
