import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeMathMarkdown } from './math-normalize.ts';

test('converte os delimitadores LaTeX do modelo para $ e $$', () => {
  assert.equal(
    normalizeMathMarkdown('A área é \\( B = \\frac{u \\cdot i}{2\\pi d} \\).'),
    'A área é $B = \\frac{u \\cdot i}{2\\pi d}$.',
  );
  assert.equal(
    normalizeMathMarkdown('\\[ B = \\frac{u \\cdot i}{2\\pi d} \\]'),
    '$$B = \\frac{u \\cdot i}{2\\pi d}$$',
  );
});

test('o bloco \\[ \\] multilinha deixa de ficar em bruto', () => {
  assert.equal(
    normalizeMathMarkdown('\\[\nB = \\frac{u\\cdot i}{2\\pi d}\n\\]'),
    '$$B = \\frac{u\\cdot i}{2\\pi d}$$',
  );
});

test('junta um $…$ partido por linhas e aspa os espaços encostados', () => {
  assert.equal(
    normalizeMathMarkdown('Campo $B =\n(u*i)/(2*pi*d)$ no fim'),
    'Campo $B = (u*i)/(2*pi*d)$ no fim',
  );
  assert.equal(normalizeMathMarkdown('$ x + 1 $'), '$x + 1$');
});

test('dinheiro não é fórmula', () => {
  assert.equal(normalizeMathMarkdown('custa $ 5 e $ 6'), 'custa $ 5 e $ 6');
  assert.equal(normalizeMathMarkdown('$ 12,50 por dia'), '$ 12,50 por dia');
});

test('asteriscos soltos viram lista, sem tocar em multiplicações', () => {
  assert.equal(normalizeMathMarkdown('* um\n* dois'), '- um\n- dois');
  assert.equal(
    normalizeMathMarkdown('Passos: * isolar u * substituir na fórmula'),
    'Passos:\n- isolar u\n- substituir na fórmula',
  );
  assert.equal(normalizeMathMarkdown('a * b * c'), 'a * b * c');
});

test('código em linha e blocos de código ficam byte a byte', () => {
  assert.equal(normalizeMathMarkdown('`$x$` e \\(y^2\\)'), '`$x$` e $y^2$');
  assert.equal(
    normalizeMathMarkdown('```\nval: $ x $ * item\n```'),
    '```\nval: $ x $ * item\n```',
  );
});

test('é idempotente: normalizar duas vezes não muda o texto', () => {
  const once = normalizeMathMarkdown('Passos: * um * dois\n\n\\( x^2 \\)');
  assert.equal(normalizeMathMarkdown(once), once);
});
