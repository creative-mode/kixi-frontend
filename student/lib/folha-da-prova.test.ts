import assert from 'node:assert/strict';
import test from 'node:test';

import { buildPaper, containsLeaf, leafNumber } from './folha-da-prova.ts';
import type { ExamQuestion } from './exam-rules.ts';

const opt = (id: number, label: string, optionText: string) => ({ id, optionLabel: label, optionText });

// Como `orderQuestions` as entrega: as questões-pai já saíram, e cada alínea traz o enunciado comum.
const QUESTIONS: ExamQuestion[] = [
  { id: 1, number: 1, text: 'Qual é o ID do roteador?', maxScore: 5, options: [opt(11, 'A', '10.1.0.1'), opt(12, 'B', '192.168.1.100')] },
  { id: 20, number: 201, parentId: 2, label: 'a', parentText: 'Dados os valores abaixo:', parentNumber: 2, text: 'Calcule x.', maxScore: 2, options: [] },
  { id: 21, number: 202, parentId: 2, label: 'b', parentText: 'Dados os valores abaixo:', parentNumber: 2, text: 'Calcule y.', maxScore: 3, options: [] },
  { id: 3, number: 3, text: 'Explique o ciclo de vida.', maxScore: 4, options: [] },
];

test('as questões de topo ficam como estão e as alíneas juntam-se na questão a que pertencem', () => {
  const paper = buildPaper(QUESTIONS);
  assert.deepEqual(paper.map((p) => [p.number, p.items.length]), [[1, 0], [2, 2], [3, 0]]);
  assert.equal(paper[1].text, 'Dados os valores abaixo:');
  assert.equal(paper[1].groupId, 2);
  assert.deepEqual(paper[1].items.map((i) => i.label), ['a', 'b']);
});

test('a cotação de uma questão com alíneas é a soma das alíneas', () => {
  assert.equal(buildPaper(QUESTIONS)[1].maxScore, 5);
  assert.equal(buildPaper(QUESTIONS)[0].maxScore, 5);
});

test('uma alínea sem letra recebe a seguinte, por ordem', () => {
  const paper = buildPaper([
    { id: 30, number: 301, parentText: 'Grupo', parentNumber: 3, text: 'x', options: [] },
    { id: 31, number: 302, parentText: 'Grupo', parentNumber: 3, text: 'y', options: [] },
  ]);
  assert.deepEqual(paper[0].items.map((i) => i.label), ['a', 'b']);
});

test('a folha sabe se contém a questão que o aluno tem aberta, e como se lê o seu número', () => {
  const paper = buildPaper(QUESTIONS);
  assert.ok(containsLeaf(paper[1], 21) && !containsLeaf(paper[0], 21) && containsLeaf(paper[0], 1));
  assert.equal(leafNumber(paper[1], paper[1].items[1]), '2b');
  assert.equal(leafNumber(paper[2]), '3');
});

test('as opções seguem a questão e a ordem das questões segue o número', () => {
  const paper = buildPaper([...QUESTIONS].reverse());
  assert.deepEqual(paper.map((p) => p.number), [1, 2, 3]);
  assert.deepEqual(paper[0].options.map((o) => o.optionLabel), ['A', 'B']);
});
