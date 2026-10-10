import assert from 'node:assert/strict';
import test from 'node:test';

import { approvalProblem, type GateStatement } from './gate';

const choice = (number: number, maxScore: number, isCorrect: boolean[], extra: Partial<GateStatement['questions'][number]> = {}) => ({
  number,
  maxScore,
  options: isCorrect.map((c) => ({ isCorrect: c, deletedAt: null })),
  deletedAt: null,
  ...extra,
});
const open = (number: number, maxScore: number, extra: Partial<GateStatement['questions'][number]> = {}) => ({
  number,
  maxScore,
  deletedAt: null,
  ...extra,
});

test('um enunciado completo passa o gate', () => {
  assert.equal(approvalProblem({ totalMaxScore: 20, questions: [choice(1, 10, [true, false]), open(2, 10)] }), null);
});

test('falta o gabarito e o gate diz em que questões', () => {
  const msg = approvalProblem({ totalMaxScore: 4, questions: [choice(1, 2, [true, false]), choice(2, 2, [false, false])] });
  assert.match(msg!, /question 2$/);
});

test('mais do que uma pergunta sem gabarito é nomeada de uma vez', () => {
  const msg = approvalProblem({ totalMaxScore: 6, questions: [choice(1, 2, [false, false]), choice(2, 2, [false, true]), choice(3, 2, [false, false])] });
  assert.match(msg!, /question 1, 3/);
});

test('uma pergunta aberta nunca chumba por falta de gabarito', () => {
  // answerKeyComplete só olha para perguntas que têm opções.
  assert.equal(approvalProblem({ totalMaxScore: 5, questions: [open(1, 5)] }), null);
});

test('uma opção correcta que foi apagada não é resposta', () => {
  // setCorrectOption e o query que marca ignoram linhas removidas.
  const q = choice(1, 2, [true, false]);
  q.options[0].deletedAt = '2026-01-01 00:00:00';
  assert.match(approvalProblem({ totalMaxScore: 2, questions: [q] })!, /question 1/);
});

test('uma pergunta apagada não é uma pergunta sem gabarito', () => {
  const q = choice(1, 2, [false, false], { deletedAt: '2026-01-01 00:00:00' });
  assert.equal(approvalProblem({ totalMaxScore: 0, questions: [q] }), null);
});

test('uma pergunta apagada também não conta para a soma', () => {
  // Um enunciado cuja única pergunta foi apagada vale 0, e é isso que a soma diz.
  const q = choice(1, 20, [true, false], { deletedAt: '2026-01-01 00:00:00' });
  assert.equal(approvalProblem({ totalMaxScore: 0, questions: [q] }), null);
  assert.match(approvalProblem({ totalMaxScore: 20, questions: [q] })!, /add up to 0.00 but the statement is worth 20.00/);
});

test('a soma tem de bater com o total declarado', () => {
  assert.match(approvalProblem({ totalMaxScore: 20, questions: [open(1, 10), open(2, 8)] })!, /add up to 18.00 but the statement is worth 20.00/);
});

test('a comparação é a duas casas, como o BigDecimal do servidor', () => {
  // A soma volta do R2DBC em double. `0.1 + 0.2` não pode chumbar o enunciado.
  assert.equal(approvalProblem({ totalMaxScore: 0.3, questions: [open(1, 0.1), open(2, 0.2)] }), null);
});

test('sem total declarado não há o que comparar', () => {
  // A coluna é nullable e os enunciados do OCR são anteriores a ela.
  assert.equal(approvalProblem({ totalMaxScore: null, questions: [open(1, 10), open(2, 10)] }), null);
  assert.equal(approvalProblem({ questions: [open(1, 10)] }), null);
});

test('o gabarito em falta ganha ao total errado, porque é o que trava a leitura', () => {
  const msg = approvalProblem({ totalMaxScore: 99, questions: [choice(1, 2, [false, false])] });
  assert.match(msg!, /no correct option/);
});

test('as duas regras são independentes e ambas dão 422', () => {
  const soGabarito = approvalProblem({ totalMaxScore: 2, questions: [choice(1, 2, [false, false])] });
  const soSoma = approvalProblem({ totalMaxScore: 5, questions: [open(1, 2)] });
  assert.ok(soGabarito && soSoma && soGabarito !== soSoma);
});