import assert from 'node:assert/strict';
import { test } from 'node:test';
import { historyRows } from './simulation-history.ts';

const sims = [
  { id: 1, status: 'FINISHED', finalScore: 16.4, statement: { id: 1, title: 'Redes' } },
  { id: 3, status: 'IN_PROGRESS', statement: { id: 2, title: 'SO' } },
  { id: 2, status: 'CANCELLED', finalScore: 5, statement: { id: 1, title: '  ' } },
  { id: 4, status: 'FINISHED', finalScore: 0, statement: { id: 3, title: 'MD' } },
];

test('a mais recente primeiro, e só a corrigida tem nota', () => {
  const rows = historyRows(sims);
  assert.deepEqual(rows.map((r) => r.id), [4, 3, 2, 1]);
  assert.equal(rows.find((r) => r.id === 1)?.score, '16,4');
  assert.equal(rows.find((r) => r.id === 2)?.score, undefined, 'uma cancelada não tem nota');
  assert.equal(rows.find((r) => r.id === 3)?.score, undefined);
});

test('uma nota de zero é uma nota, e um título em branco não fica em branco', () => {
  const rows = historyRows(sims);
  assert.equal(rows.find((r) => r.id === 4)?.score, '0');
  assert.equal(rows.find((r) => r.id === 2)?.title, 'Prova');
});

test('a mesma regra do cartão: o estado vem de labelOf', () => {
  const rows = historyRows(sims);
  assert.deepEqual(rows.map((r) => r.label), ['corrected', 'unfinished', 'cancelled', 'corrected']);
});

test('sem tentativas, lista vazia', () => {
  assert.deepEqual(historyRows([]), []);
});
