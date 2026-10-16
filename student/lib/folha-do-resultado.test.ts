import assert from 'node:assert/strict';
import test from 'node:test';

import { answersOf, marksOf, paperQuestions, stampOf } from './folha-do-resultado.ts';
import { buildPaper } from './folha-da-prova.ts';
import type { ResultQuestion } from './result-rules.ts';

const opt = (id: number, label: string, optionText: string) => ({ id, optionLabel: label, optionText });

const RESULT: ResultQuestion[] = [
  { questionId: 1, number: 1, text: 'Qual?', maxScore: 5, options: [opt(11, 'A', 'x'), opt(12, 'B', 'y')], correctOptionId: 12, selectedOptionId: 12, isCorrect: true, scoreObtained: 5 },
  { questionId: 20, number: 201, parentId: 2, label: 'a', parentText: 'Resolva:', text: 'Calcule.', maxScore: 3, options: [opt(31, 'A', 'p'), opt(32, 'B', 'q')], correctOptionId: 31, selectedOptionId: 32, isCorrect: false, scoreObtained: 0 },
  { questionId: 3, number: 3, text: 'Explique.', maxScore: 4, answerText: 'Porque sim.', reviewStatus: 'PENDING_REVIEW', options: [] },
  { questionId: 4, number: 4, text: 'Sem resposta.', maxScore: 2, options: [] },
];

test('a folha do resultado tem as mesmas questões e alíneas da sala', () => {
  const paper = buildPaper(paperQuestions(RESULT));
  assert.deepEqual(paper.map((p) => [p.number, p.items.length]), [[1, 0], [2, 1], [3, 0], [4, 0]]);
  assert.equal(paper[1].text, 'Resolva:');
});

test('cada questão leva o veredicto, a certa e a nota, e o aluno as suas respostas', () => {
  const marks = marksOf(RESULT);
  assert.deepEqual([1, 20, 3, 4].map((id) => marks[id].verdict), ['correct', 'wrong', 'pending', 'blank']);
  assert.equal(marks[1].correctOptionId, 12);
  assert.equal(marks[1].scoreObtained, 5);
  assert.deepEqual(answersOf(RESULT)[20], { optionId: 32, text: '' });
  assert.deepEqual(answersOf(RESULT)[3], { optionId: null, text: 'Porque sim.' });
});

test('a nota é positiva a partir de metade da cotação e negativa abaixo', () => {
  assert.equal(stampOf(14, 20, 0)?.passed, true);
  assert.equal(stampOf(10, 20, 0)?.passed, true);
  assert.equal(stampOf(9.5, 20, 0)?.passed, false);
  assert.equal(stampOf(7, 14, 0)?.passed, true);
});

test('a nota é provisória enquanto há respostas por corrigir, e sem nota não há carimbo', () => {
  assert.equal(stampOf(8, 20, 2)?.provisional, true);
  assert.equal(stampOf(8, 20, 0)?.provisional, false);
  assert.equal(stampOf(null, 20, 0), null);
  assert.equal(stampOf(12, null, 0)?.passed, null);
});
