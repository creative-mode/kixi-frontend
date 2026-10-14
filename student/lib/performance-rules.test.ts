import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPerformance, percentOf, type RawSimulation } from './performance-rules.ts';

const sim = (id: number, statementId: number, score: number, total: number, finishedAt: string, title = `P${statementId}`): RawSimulation => ({
  id, status: 'FINISHED', finalScore: score, finishedAt,
  statement: { id: statementId, title, totalMaxScore: total },
});

test('a nota sobre a escala da prova dá a percentagem', () => {
  assert.equal(percentOf(sim(1, 1, 15, 20, '2026-10-01T10:00:00')), 75);
  assert.equal(percentOf(sim(1, 1, 12.5, 20, '2026-10-01T10:00:00')), 63);
});

test('sem escala ou sem nota não há percentagem, em vez de uma barra a zero', () => {
  assert.equal(percentOf({ id: 1, finalScore: 10, statement: { totalMaxScore: null } }), null);
  assert.equal(percentOf({ id: 1, finalScore: 10, statement: { totalMaxScore: 0 } }), null);
  assert.equal(percentOf({ id: 1, finalScore: null, statement: { totalMaxScore: 20 } }), null);
});

test('só as simulações entregues contam', () => {
  const p = buildPerformance([
    sim(1, 1, 10, 20, '2026-10-01T10:00:00'),
    { id: 2, status: 'IN_PROGRESS', finalScore: null, statement: { id: 2, title: 'P2', totalMaxScore: 20 } },
    { id: 3, status: 'CANCELLED', finalScore: 5, statement: { id: 3, title: 'P3', totalMaxScore: 20 } },
  ]);
  assert.deepEqual(p.activity.map((a) => a.id), [1]);
  assert.deepEqual(p.mastery.map((m) => m.label), ['P1']);
});

test('a atividade vai da mais recente para a mais antiga', () => {
  const p = buildPerformance([
    sim(1, 1, 10, 20, '2026-10-01T10:00:00'),
    sim(2, 2, 12, 20, '2026-10-05T10:00:00'),
    sim(3, 3, 14, 20, '2026-10-03T10:00:00'),
  ]);
  assert.deepEqual(p.activity.map((a) => a.id), [2, 3, 1]);
});

test('uma prova refeita conta pela tentativa mais recente', () => {
  const p = buildPerformance([
    sim(1, 1, 8, 20, '2026-10-01T10:00:00'),
    sim(2, 1, 16, 20, '2026-10-09T10:00:00'),
  ]);
  assert.deepEqual(p.mastery, [{ id: 1, label: 'P1', value: 80 }]);
  assert.equal(p.activity.length, 2);
});

test('o domínio começa pela prova mais fraca', () => {
  const p = buildPerformance([
    sim(1, 1, 18, 20, '2026-10-01T10:00:00'),
    sim(2, 2, 6, 20, '2026-10-02T10:00:00'),
    sim(3, 3, 12, 20, '2026-10-03T10:00:00'),
  ]);
  assert.deepEqual(p.mastery.map((m) => m.value), [30, 60, 90]);
});

test('duas provas com o mesmo título continuam a ser duas, com ids diferentes', () => {
  const p = buildPerformance([
    sim(1, 1, 10, 20, '2026-10-01T10:00:00', 'Teste'),
    sim(2, 2, 12, 20, '2026-10-02T10:00:00', 'Teste'),
  ]);
  assert.deepEqual(p.mastery.map((m) => m.id), [1, 2]);
});
