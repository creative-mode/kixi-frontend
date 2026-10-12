import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  compareWithPrevious,
  formatDelta,
  formatDuration,
  formatScore,
  givenAnswers,
  inOrder,
  optionTag,
  toReview,
  verdict,
  type ResultQuestion,
} from './result-rules.ts';

const q = (over: Partial<ResultQuestion>): ResultQuestion => ({ questionId: 1, number: 1, text: 'x', ...over });

test('certa, errada, por corrigir e em branco são quatro coisas', () => {
  assert.equal(verdict(q({ isCorrect: true, selectedOptionId: 1 })), 'correct');
  assert.equal(verdict(q({ isCorrect: false, selectedOptionId: 2 })), 'wrong');
  assert.equal(verdict(q({ isCorrect: null, reviewStatus: 'PENDING_REVIEW', answerText: 'texto' })), 'pending');
  assert.equal(verdict(q({ isCorrect: false })), 'blank');
});

test('uma resposta aberta por corrigir não é um erro', () => {
  const list = [
    q({ number: 3, reviewStatus: 'PENDING_REVIEW', answerText: 'a' }),
    q({ number: 2, isCorrect: false, selectedOptionId: 9 }),
    q({ number: 1, isCorrect: true, selectedOptionId: 1 }),
  ];
  assert.deepEqual(toReview(list).map((x) => x.number), [2]);
});

test('as questões seguem a ordem da prova, sem mexer na lista recebida', () => {
  const list = [q({ number: 2 }), q({ number: 1 })];
  assert.deepEqual(inOrder(list).map((x) => x.number), [1, 2]);
  assert.deepEqual(list.map((x) => x.number), [2, 1]);
  assert.deepEqual(inOrder(undefined), []);
});

test('a nota sai como o servidor a calculou, com vírgula; sem nota não é zero', () => {
  assert.equal(formatScore(16.4), '16,4');
  assert.equal(formatScore(0), '0');
  assert.equal(formatScore(null), null);
});

test('o tempo gasto é legível', () => {
  assert.equal(formatDuration(45), '45 s');
  assert.equal(formatDuration(3120), '52 min');
  assert.equal(formatDuration(3900), '1 h 05 min');
  assert.equal(formatDuration(null), null);
});

test('compara com a tentativa terminada imediatamente anterior', () => {
  const attempts = [
    { id: 1, status: 'FINISHED', finalScore: 14.2 },
    { id: 2, status: 'CANCELLED', finalScore: null },
    { id: 3, status: 'IN_PROGRESS', finalScore: null },
    { id: 5, status: 'FINISHED', finalScore: 19 },
  ];
  const c = compareWithPrevious(4, 16.4, attempts);
  assert.deepEqual(c, { previousScore: 14.2, delta: 2.2 });
  assert.equal(compareWithPrevious(1, 14.2, attempts), null, 'a primeira não tem anterior');
  assert.equal(compareWithPrevious(4, null, attempts), null);
});

test('a diferença mostra o sinal', () => {
  assert.equal(formatDelta(2.2), '+2,2');
  assert.equal(formatDelta(-1.5), '-1,5');
  assert.equal(formatDelta(0), '0');
});

test('a etiqueta da opção é a da prova, ou a letra pela posição', () => {
  assert.equal(optionTag({ id: 1, optionLabel: 'B', optionText: 'x' }, 0), 'B');
  assert.equal(optionTag({ id: 1, optionLabel: ' ', optionText: 'x' }, 2), 'C');
});

test('o que o aluno respondeu viaja para o tutor pelo número da questão', () => {
  const list = [
    q({ number: 1, isCorrect: true, selectedOptionId: 1, options: [{ id: 1, optionText: 'Certa' }] }),
    q({ number: 2, isCorrect: false, selectedOptionId: 9, options: [{ id: 9, optionText: '/24' }] }),
    q({ number: 3, isCorrect: false, selectedOptionId: null, answerText: 'porque sim' }),
  ];
  assert.deepEqual([...givenAnswers(list)], [[2, '/24'], [3, 'porque sim']]);
});

test('uma questão em branco não leva resposta nenhuma', () => {
  assert.equal(givenAnswers([q({ number: 4, isCorrect: false })]).size, 0);
  assert.equal(givenAnswers([q({ number: 5, isCorrect: false, answerText: '   ' })]).size, 0);
});

test('uma resposta por corrigir não é tratada como erro do aluno', () => {
  const list = [q({ number: 6, isCorrect: null, reviewStatus: 'PENDING_REVIEW', answerText: 'texto' })];
  assert.equal(givenAnswers(list).size, 0);
});
