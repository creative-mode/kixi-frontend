import assert from 'node:assert/strict';
import { test } from 'node:test';
import { institutionsCounted, percentiles, rankGlobal, withinFloor, type Scored } from './global-ranking.ts';

const school = (institutionId: number, averages: number[], first = institutionId * 100): Scored[] =>
  averages.map((average, i) => ({ accountId: first + i, institutionId, average }));

test('o percentil é a fração da própria escola a par ou abaixo, de 0 a 100', () => {
  const p = percentiles(school(1, [10, 12, 14, 16]));
  assert.equal(p.get(103), 100);
  assert.equal(p.get(100), 25);
});

test('o melhor aluno de uma escola pequena e o de uma grande valem o mesmo percentil', () => {
  const p = percentiles([...school(1, [10, 20]), ...school(2, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10])]);
  assert.equal(p.get(101), 100);
  assert.equal(p.get(209), 100);
});

test('uma escola abaixo do mínimo sai inteira, e quem lá estuda não conta', () => {
  const rows = [...school(1, [10, 11, 12], 100), ...school(2, [1, 2, 3, 4], 200)];
  assert.equal(withinFloor(rows, 4).every((r) => r.institutionId === 2), true);
  assert.equal(institutionsCounted(rows, 4), 1);
  assert.equal(institutionsCounted(rows, 10), 0);
});

test('o ranking ordena pelo percentil e desempata pela média', () => {
  const rows = [...school(1, [10, 14], 100), ...school(2, [18, 19], 200)];
  const ranked = rankGlobal(rows, 2);
  assert.deepEqual(ranked.map((r) => r.accountId), [201, 101, 200, 100]);
  assert.equal(ranked[0].position, 1);
});

test('empates ficam com a mesma posição, como numa corrida', () => {
  const ranked = rankGlobal([...school(1, [10, 10, 5], 100)], 3);
  assert.deepEqual(ranked.map((r) => r.position), [1, 1, 3]);
});
