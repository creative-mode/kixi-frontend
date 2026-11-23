import test from 'node:test';
import assert from 'node:assert/strict';
import { imageAlt, nextIndex, previousIndex, stepIndex, swipeStep } from './lightbox.ts';

test('navegar dá a volta nas pontas da galeria', () => {
  assert.equal(nextIndex(0, 3), 1);
  assert.equal(nextIndex(2, 3), 0);
  assert.equal(previousIndex(0, 3), 2);
  assert.equal(previousIndex(1, 3), 0);
});

test('uma galeria de uma imagem fica sempre na mesma', () => {
  assert.equal(nextIndex(0, 1), 0);
  assert.equal(previousIndex(0, 1), 0);
  assert.equal(stepIndex(4, 0, 1), 0);
});

test('o swipe para a esquerda mostra a seguinte, para a direita a anterior', () => {
  assert.equal(swipeStep(-90), 1);
  assert.equal(swipeStep(90), -1);
  assert.equal(swipeStep(-12), 0);
  assert.equal(swipeStep(12), 0);
});

test('o texto alternativo nunca fica vazio e prefere o que o autor escreveu', () => {
  assert.equal(imageAlt('Esquema de uma rede', 'Imagem da publicação'), 'Esquema de uma rede');
  assert.equal(imageAlt('  ', 'Imagem da publicação'), 'Imagem da publicação');
  assert.equal(imageAlt(null, 'Figura da questão'), 'Figura da questão');
  assert.equal(imageAlt(undefined, 'Imagem da publicação'), 'Imagem da publicação');
});
