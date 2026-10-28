// Testes das pendências do gabarito:  node --test lib/crud/answer-key.test.ts
//
// Fixam que o cliente aponta o mesmo que o `POST /approve` do servidor recusaria,
// e nada que o servidor aceite. Divergir nos dois sentidos foi o que a revisão do
// #117 encontrou: escolha múltipla sem opções bloqueada à toa, e questão aberta
// com opções a passar no cliente para levar 422 no servidor.
import test from 'node:test';
import assert from 'node:assert/strict';
import { answerKeyIssues, gabaritosEmFalta, sumOfScores } from './answer-key.ts';

const q = (number: number, maxScore: number, correct: boolean[] = []) => ({
  number,
  maxScore,
  options: correct.map((isCorrect) => ({ isCorrect })),
});

test('questão com opções e nenhuma correta é pendência', () => {
  assert.deepEqual(answerKeyIssues([q(1, 10, [false, false]), q(2, 10, [true, false])], 20), [
    'Questão 1 tem opções mas nenhuma marcada como correta',
  ]);
});

test('questão sem opções não precisa de resposta correta, seja qual for o tipo', () => {
  assert.deepEqual(answerKeyIssues([q(1, 20)], 20), []);
});

test('a resposta modelo não é pedida: o servidor não a exige para aprovar', () => {
  assert.deepEqual(answerKeyIssues([{ ...q(1, 20), modelAnswer: '' } as never], 20), []);
});

test('cotações que não somam ao total declarado são pendência', () => {
  assert.deepEqual(answerKeyIssues([q(1, 5, [true]), q(2, 5, [true])], 20), ['As cotações somam 10, mas a prova vale 20']);
});

test('a soma é a das cotações guardadas a 2 casas, como o DECIMAL do servidor', () => {
  assert.deepEqual(answerKeyIssues([q(1, 0.1, [true]), q(2, 0.2, [true])], 0.3), []);
  // 20/6 fica 3,33 na coluna: seis dão 19,98, e o servidor recusa.
  assert.deepEqual(answerKeyIssues(Array.from({ length: 6 }, (_, i) => q(i + 1, 20 / 6)), 20), ['As cotações somam 19,98, mas a prova vale 20']);
});

test('sem total declarado a soma não é verificada', () => {
  assert.deepEqual(answerKeyIssues([q(1, 3, [true])], null), []);
});

test('o total em branco preenche-se com a soma das cotações, a 2 casas', () => {
  assert.equal(sumOfScores([q(1, 5), q(2, 5), q(3, 5)]), 15);
  assert.equal(sumOfScores([q(1, 0.1), q(2, 0.2)]), 0.3);
});

test('sem cotações não há total, em vez de uma escala de zero', () => {
  assert.equal(sumOfScores([q(1, 0), q(2, 0)]), null);
  assert.equal(sumOfScores([]), null);
});

const aberta = (id: number, extra: Record<string, unknown> = {}) => ({ id, maxScore: 5, options: [] as unknown[], modelAnswer: '', questionType: 'open', ...extra });

test('gabaritos em falta: só as abertas com pontos e sem resposta modelo', () => {
  const qs = [
    aberta(1), // em falta
    aberta(2, { modelAnswer: 'A resposta.' }), // tem
    aberta(3, { modelAnswer: '   ' }), // só espaços: em falta
    aberta(4, { options: [{ isCorrect: true }], questionType: 'multiple_choice' }), // escolha múltipla: não se aplica
    aberta(5, { questionType: 'group', maxScore: 0 }), // enunciado comum: não se aplica
    aberta(6, { maxScore: 0 }), // não vale pontos
    aberta(7, { modelAnswer: null }), // em falta
    aberta(8, { questionType: 'GROUP' }), // tipo com outra grafia
  ];
  assert.deepEqual(gabaritosEmFalta(qs).map((q) => q.id), [1, 3, 7]);
});

test('a falta de gabarito não é pendência: continua a não bloquear a aprovação', () => {
  assert.deepEqual(answerKeyIssues([{ ...q(1, 20), modelAnswer: '' } as never], 20), []);
  assert.equal(gabaritosEmFalta([aberta(1, { maxScore: 20 })]).length, 1);
});
