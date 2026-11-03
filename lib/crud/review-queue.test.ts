// A fila de enunciados por rever (#535): node --test lib/crud/review-queue.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { matchesStatementFilter, queuePlace, reviewQueue, statementCounts } from './review-queue.ts';

const linhas = [
  { id: 1, needsReview: false, source: 'MANUAL' },
  { id: 2, needsReview: true, source: 'OCR' },
  { id: 3, needsReview: true, source: 'ocr' },
  { id: 4, needsReview: false, source: 'ocr' },
  { id: 5, needsReview: true, source: 'manual' },
];

test('cada filtro corresponde ao do servidor: para rever e vindos do OCR', () => {
  assert.deepEqual(linhas.filter((r) => matchesStatementFilter(r, 'rever')).map((r) => r.id), [2, 3, 5]);
  assert.deepEqual(linhas.filter((r) => matchesStatementFilter(r, 'ocr')).map((r) => r.id), [2, 3, 4]);
  assert.equal(linhas.filter((r) => matchesStatementFilter(r, 'todos')).length, 5);
});

test('o OCR conta-se em maiúsculas ou minúsculas', () => {
  assert.ok(matchesStatementFilter({ source: 'OCR' }, 'ocr'));
  assert.ok(matchesStatementFilter({ source: 'ocr' }, 'ocr'));
  assert.ok(!matchesStatementFilter({ source: null }, 'ocr'));
  assert.ok(!matchesStatementFilter({}, 'ocr'));
});

test('só um «true» a sério põe o enunciado na fila de revisão', () => {
  assert.ok(!matchesStatementFilter({ needsReview: 'true' }, 'rever'));
  assert.ok(!matchesStatementFilter({ needsReview: 1 }, 'rever'));
  assert.ok(!matchesStatementFilter({}, 'rever'));
});

test('as contagens de cada filtro', () => {
  assert.deepEqual(statementCounts(linhas), { todos: 5, rever: 3, ocr: 3 });
  assert.deepEqual(statementCounts([]), { todos: 0, rever: 0, ocr: 0 });
});

test('a fila é a dos por rever, pela ordem da lista', () => {
  assert.deepEqual(reviewQueue(linhas), [2, 3, 5]);
});

test('depois de aprovar o do meio abre-se o seguinte', () => {
  assert.deepEqual(queuePlace([2, 3, 5], 3), { position: 2, total: 3, previous: 2, following: 5, next: 5 });
});

test('depois de aprovar o último volta-se ao primeiro que sobra, em vez de acabar com trabalho por fazer', () => {
  assert.equal(queuePlace([2, 3, 5], 5).next, 2);
  assert.equal(queuePlace([2, 3, 5], 5).previous, 3);
});

test('o primeiro não tem anterior', () => {
  assert.equal(queuePlace([2, 3, 5], 2).previous, null);
  assert.equal(queuePlace([2, 3, 5], 2).position, 1);
});

test('sozinho na fila não há seguinte', () => {
  assert.deepEqual(queuePlace([7], 7), { position: 1, total: 1, previous: null, following: null, next: null });
});

test('um enunciado que já não está na fila continua a ter um seguinte', () => {
  assert.deepEqual(queuePlace([2, 3], 9), { position: null, total: 2, previous: null, following: null, next: 2 });
  assert.equal(queuePlace([], 9).next, null);
});

test('andar pela fila não dá a volta: no último não há seguinte, mas aprovar abre o primeiro que sobra', () => {
  const ultimo = queuePlace([2, 3, 5], 5);
  assert.equal(ultimo.following, null);
  assert.equal(ultimo.next, 2);
  assert.equal(queuePlace([2, 3, 5], 2).following, 3);
});
