// node --test lib/mock/training.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { allocate, pickForTopic, planItems, type Candidate } from './training.ts';
import { SEED_BY_STATEMENT, SEED_MATRICES, SEED_QUESTION_TOPICS, SEED_QUESTIONS, TOPICS } from './training-seed.ts';

/** O treino por temas no mock tem de obedecer às regras do backend: sem repetir, sem vazar a prova, sem a mesma prova toda. */

const cand = (questionId: number, statementId: number, extra: Partial<Candidate> = {}): Candidate => ({
  questionId, statementId, statementTitle: `P${statementId}`, year: '2024/2025', topicIds: [1], history: 'new', ...extra,
});

test('as nunca tentadas vêm antes das falhadas e estas antes das já certas', () => {
  const pool = [cand(1, 1, { history: 'right' }), cand(2, 1, { history: 'wrong' }), cand(3, 1, { history: 'new' })];
  assert.deepEqual(pickForTopic(pool, 3).map((c) => c.questionId), [3, 2, 1]);
});

test('reparte as questões por provas diferentes em vez de esgotar uma', () => {
  const pool = [cand(1, 1), cand(2, 1), cand(3, 1), cand(4, 2), cand(5, 3)];
  const chosen = pickForTopic(pool, 3);
  assert.deepEqual(new Set(chosen.map((c) => c.statementId)), new Set([1, 2, 3]));
});

test('a prova mais recente desempata', () => {
  const pool = [cand(1, 1, { year: '2022/2023' }), cand(2, 2, { year: '2025/2026' })];
  assert.equal(pickForTopic(pool, 1)[0]!.questionId, 2);
});

test('uma questão nunca entra em dois temas e o que falta fica registado', () => {
  const pool = [cand(1, 1, { topicIds: [1, 2] }), cand(2, 1, { topicIds: [2] })];
  const { questionIds, allocation } = allocate(pool, [{ topicId: 1, count: 2 }, { topicId: 2, count: 2 }]);
  assert.deepEqual(questionIds, [1, 2]);
  assert.deepEqual(allocation, [{ topicId: 1, requested: 2, provided: 1 }, { topicId: 2, requested: 2, provided: 1 }]);
});

test('a semente: cada tema da matriz tem questões a treinar e as quantidades somam 20 valores', () => {
  const matrix = SEED_MATRICES[0]!;
  assert.equal(matrix.items.reduce((n, i) => n + (i.points ?? 0), 0), matrix.totalPoints);
  const pool: Candidate[] = Object.entries(SEED_BY_STATEMENT).flatMap(([statementId, ids]) =>
    Number(statementId) === 9 ? [] : ids.filter((id) => SEED_QUESTION_TOPICS[id]).map((id) => cand(id, Number(statementId), { topicIds: SEED_QUESTION_TOPICS[id]! })));
  const items = planItems(matrix, TOPICS, pool);
  assert.equal(items.length, 4);
  for (const item of items) assert.ok(item.available >= item.questionCount, `${item.name} tem poucas questões`);
  assert.ok(items.every((i) => i.sources.length >= 2), 'cada tema vem de mais de uma prova');
  assert.ok(SEED_QUESTIONS.every((q) => q.options.filter((o) => o.isCorrect).length === 1));
});
