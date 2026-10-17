import assert from 'node:assert/strict';
import { test } from 'node:test';
import { countLeafQuestions } from './leaf-count.ts';

test('conta as questões e as alíneas, mas não o enunciado comum de um grupo', () => {
  // 1 e 2 soltas; 3 é um grupo com as alíneas 4 e 5.
  assert.equal(countLeafQuestions([1, 2, 3, 4, 5], [null, null, null, 3, 3]), 4);
});

test('uma prova sem grupos conta todas as questões', () => {
  assert.equal(countLeafQuestions([1, 2, 3], [undefined, null, null]), 3);
});

test('uma prova vazia tem zero', () => {
  assert.equal(countLeafQuestions([], []), 0);
});
