// Testes das pendências do gabarito:  node --test lib/crud/answer-key.test.ts
//
// Fixam que o cliente aponta o mesmo que o `POST /approve` do servidor recusaria,
// e nada que o servidor aceite. Divergir nos dois sentidos foi o que a revisão do
// #117 encontrou: escolha múltipla sem opções bloqueada à toa, e questão aberta
// com opções a passar no cliente para levar 422 no servidor.
import test from 'node:test';
import assert from 'node:assert/strict';
import { answerKeyIssues } from './answer-key.ts';

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
