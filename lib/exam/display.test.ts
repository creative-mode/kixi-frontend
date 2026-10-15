import assert from 'node:assert/strict';
import test from 'node:test';

import { displayNumber, isGroup, orderWithGroups, type TreeQuestion } from './display.ts';

const q = (id: number, number: number, extra: Partial<TreeQuestion> = {}): TreeQuestion => ({ id, number, ...extra });
/** 1, 2, 3 (grupo com 3a, 3b), 4, 5 (grupo com 5a). Os filhos chegam fora de ordem de propósito. */
const LISTA = [
  q(11, 301, { parentId: 3, label: 'a' }), q(5, 4), q(3, 3, { questionType: 'group' }), q(1, 1), q(12, 302, { parentId: 3, label: 'b' }),
  q(2, 2), q(6, 5, { questionType: 'group' }), q(13, 501, { parentId: 6, label: 'a' }),
];

test('cada alínea fica logo a seguir ao pai, e as de topo pela ordem do número', () => {
  assert.deepEqual(orderWithGroups(LISTA).map((x) => x.number), [1, 2, 3, 301, 302, 4, 5, 501]);
});

test('o número a mostrar é o do pai com a letra: 3a, 3b, 5a', () => {
  const todas = orderWithGroups(LISTA);
  assert.deepEqual(todas.map((x) => displayNumber(x, todas)), ['1', '2', '3', '3a', '3b', '4', '5', '5a']);
});

test('nunca se mostra o número interno de uma alínea', () => {
  const todas = orderWithGroups(LISTA);
  assert.ok(!todas.map((x) => displayNumber(x, todas)).some((n) => /^\d{3,}/.test(n)));
});

test('uma alínea cujo pai não está na lista não desaparece e aparece como questão de topo', () => {
  const sozinha = [q(9, 401, { parentId: 4, label: 'a' }), q(1, 1)];
  assert.deepEqual(orderWithGroups(sozinha).map((x) => x.id), [1, 9]);
  assert.equal(displayNumber(sozinha[0], sozinha), '401a');
});

test('um grupo reconhece-se pelo tipo', () => {
  assert.equal(isGroup(q(1, 1, { questionType: 'group' })), true);
  assert.equal(isGroup(q(1, 1, { questionType: 'GROUP' })), true);
  assert.equal(isGroup(q(1, 1, { questionType: 'open' })), false);
  assert.equal(isGroup(q(1, 1)), false);
});

test('uma lista sem alíneas fica como estava, ordenada', () => {
  assert.deepEqual(orderWithGroups([q(2, 2), q(1, 1), q(3, 3)]).map((x) => x.number), [1, 2, 3]);
});
