import assert from 'node:assert/strict';
import test from 'node:test';

import { displayNumber, isItem, itemLabel, topNumber, wholeNumbers } from './question-number.ts';

test('uma questão de topo mostra o seu número', () => {
  assert.equal(displayNumber({ number: 5 }), '5');
  assert.equal(displayNumber({ number: 12, parentId: null }), '12');
});

test('uma alínea mostra a questão e a letra: 3a, 5b', () => {
  assert.equal(displayNumber({ number: 301, label: 'a', parentId: 40 }), '3a');
  assert.equal(displayNumber({ number: 502, label: 'b', parentId: 41 }), '5b');
});

test('sem rótulo nem pai (como na comunidade), o número chega: 301 é 3a e 304 é 3d', () => {
  assert.equal(displayNumber({ number: 301 }), '3a');
  assert.equal(displayNumber({ number: 304 }), '3d');
  assert.equal(displayNumber({ number: 1026 }), '10z');
  assert.equal(displayNumber({ number: 1027 }), '10aa');
});

test('o rótulo que o servidor dá vale mais do que o derivado do número', () => {
  assert.equal(displayNumber({ number: 301, label: 'x', parentId: 40 }), '3x');
});

test('sem número não há nada a mostrar', () => {
  assert.equal(displayNumber({ number: null }), '—');
});

test('nunca se mostra um número de três algarismos como questão', () => {
  for (const n of [101, 205, 399, 1204]) assert.doesNotMatch(displayNumber({ number: n }), /^\d{3,}$/);
});

test('o número da questão inteira: 301 → 3, e uma de topo fica', () => {
  assert.equal(topNumber(301), 3);
  assert.equal(topNumber(1204), 12);
  assert.equal(topNumber(7), 7);
});

test('uma alínea reconhece-se pelo pai ou pelo número', () => {
  assert.equal(isItem({ number: 3, parentId: 9 }), true);
  assert.equal(isItem({ number: 301 }), true);
  assert.equal(isItem({ number: 3 }), false);
});

test('o tutor recebe as questões inteiras, sem repetir e por ordem', () => {
  assert.deepEqual(wholeNumbers([{ number: 302 }, { number: 301 }, { number: 6 }, { number: 502 }, { number: 6 }]), [3, 5, 6]);
  assert.deepEqual(wholeNumbers([]), []);
});

test('rótulos das alíneas', () => {
  assert.deepEqual([0, 1, 25, 26].map(itemLabel), ['a', 'b', 'z', 'aa']);
});
