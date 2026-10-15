import assert from 'node:assert/strict';
import test from 'node:test';

import { displayNumber, isGroup, type TreeQuestion } from './display.ts';

const q = (id: number, number: number, extra: Partial<TreeQuestion> = {}): TreeQuestion => ({ id, number, ...extra });
/** 1, 2, 3 (grupo com 3a, 3b), 4, 5 (grupo com 5a), na ordem em que o servidor as manda. */
const LISTA = [
  q(1, 1), q(2, 2), q(3, 3, { questionType: 'group' }), q(11, 301, { parentId: 3, label: 'a' }), q(12, 302, { parentId: 3, label: 'b' }),
  q(5, 4), q(6, 5, { questionType: 'group' }), q(13, 501, { parentId: 6, label: 'a' }),
];

test('o número a mostrar é o do pai com a letra: 3a, 3b, 5a', () => {
  assert.deepEqual(LISTA.map((x) => displayNumber(x, LISTA)), ['1', '2', '3', '3a', '3b', '4', '5', '5a']);
});

test('nunca se mostra o número interno de uma alínea', () => {
  assert.ok(!LISTA.map((x) => displayNumber(x, LISTA)).some((n) => /^\d{3,}/.test(n)));
});

test('uma alínea cujo pai não está na lista mostra o número e a letra', () => {
  const sozinha = [q(9, 401, { parentId: 4, label: 'a' }), q(1, 1)];
  assert.equal(displayNumber(sozinha[0], sozinha), '401a');
});

test('um grupo reconhece-se pelo tipo', () => {
  assert.equal(isGroup(q(1, 1, { questionType: 'group' })), true);
  assert.equal(isGroup(q(1, 1, { questionType: 'GROUP' })), true);
  assert.equal(isGroup(q(1, 1, { questionType: 'open' })), false);
  assert.equal(isGroup(q(1, 1)), false);
});
