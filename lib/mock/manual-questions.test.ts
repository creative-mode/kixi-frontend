import assert from 'node:assert/strict';
import test from 'node:test';

import { buildQuestions, itemLabelAt, type BuildResult, type RawQuestion } from './manual-questions.ts';

function build(qs: RawQuestion[]): BuildResult {
  let q = 0;
  let o = 0;
  return buildQuestions(qs, () => ++q, () => ++o);
}
const ok = (r: BuildResult) => { assert.equal(r.ok, true, r.ok ? '' : r.message); return r as Extract<BuildResult, { ok: true }>; };

const OGI: RawQuestion[] = [
  { text: 'Q1', type: 'open', maxScore: 2 },
  { text: 'Q2', type: 'open', maxScore: 2 },
  { text: 'Q3 V/F', type: 'group', items: [
    { text: 'a', type: 'true_false', maxScore: 2, options: [{ label: 'A', text: 'Verdadeiro', correct: true }, { label: 'B', text: 'Falso' }] },
    { text: 'b', type: 'true_false', maxScore: 2, options: [{ label: 'A', text: 'Verdadeiro' }, { label: 'B', text: 'Falso', correct: true }] },
  ] },
  { text: 'Q4', type: 'open', maxScore: 4 },
  { text: 'Q5 composta', type: 'group', items: [{ text: 'a', type: 'open', maxScore: 4 }, { text: 'b', type: 'open', maxScore: 4 }] },
];

test('numeração: as de topo levam o número impresso, as alíneas pai*100+índice, e o pai vem antes dos filhos', () => {
  const { questions } = ok(build(OGI));
  assert.deepEqual(questions.map((q) => q.number), [1, 2, 3, 301, 302, 4, 5, 501, 502]);
  assert.deepEqual(questions.map((q) => q.label), [null, null, null, 'a', 'b', null, null, 'a', 'b']);
  assert.deepEqual(questions.map((q) => q.questionType), ['open', 'open', 'group', 'true_false', 'true_false', 'open', 'group', 'open', 'open']);
  const q3 = questions.find((q) => q.number === 3)!;
  assert.deepEqual(questions.filter((q) => q.parentId === q3.id).map((q) => q.number), [301, 302]);
  assert.deepEqual(questions.map((q) => q.orderIndex), [0, 1, 2, 3, 4, 5, 6, 7, 8]);
});

test('o total soma só as folhas e o grupo não tem cotação própria', () => {
  const r = ok(build(OGI));
  assert.equal(r.total, 2 + 2 + 2 + 2 + 4 + 4 + 4);
  assert.equal(r.questions.find((q) => q.questionType === 'group')!.maxScore, null);
});

test('as opções de verdadeiro/falso ficam com a correta marcada; sem opções recebem as duas por defeito', () => {
  const { questions } = ok(build([...OGI.slice(2, 3), { text: 'sem opções', type: 'group', items: [{ text: 'x', type: 'true_false' }] }]));
  const a = questions.find((q) => q.text === 'a')!;
  assert.deepEqual(a.options.map((o) => [o.optionLabel, o.optionText, o.isCorrect]), [['A', 'Verdadeiro', true], ['B', 'Falso', false]]);
  const sem = questions.find((q) => q.text === 'x')!;
  assert.deepEqual(sem.options.map((o) => [o.optionText, o.isCorrect]), [['Verdadeiro', false], ['Falso', false]]);
});

test('sem tipo, o pedido antigo continua a valer: opções → escolha múltipla, sem opções → aberta', () => {
  const { questions } = ok(build([{ text: 'a', maxScore: 1 }, { text: 'b', maxScore: 1, options: [{ label: 'A', text: 'x', correct: true }, { label: 'B', text: 'y' }] }]));
  assert.deepEqual(questions.map((q) => q.questionType), ['open', 'multiple_choice']);
});

test('um grupo sem alíneas, com cotação própria ou com opções é recusado com a questão nomeada', () => {
  const semItens = build([{ text: 'g', type: 'group', items: [] }]);
  assert.equal(semItens.ok, false);
  assert.match(!semItens.ok ? semItens.message : '', /Questão 1: .*pelo menos uma alínea/);
  assert.equal(build([{ text: 'g', type: 'group', maxScore: 4, items: [{ text: 'a', type: 'open' }] }]).ok, false);
  assert.equal(build([{ text: 'g', type: 'group', options: [{ text: 'x' }], items: [{ text: 'a', type: 'open' }] }]).ok, false);
});

test('uma alínea não pode ser outro grupo, nem ter tipo desconhecido, nem texto vazio', () => {
  assert.equal(build([{ text: 'g', type: 'group', items: [{ text: 'a', type: 'group' }] }]).ok, false);
  assert.equal(build([{ text: 'g', type: 'group', items: [{ text: 'a', type: 'banana' }] }]).ok, false);
  const vazio = build([{ text: 'g', type: 'group', items: [{ text: ' ', type: 'open' }] }]);
  assert.match(!vazio.ok ? vazio.message : '', /Questão 1a: o texto da alínea é obrigatório/);
});

test('verdadeiro/falso com três opções, ou duas corretas, é recusado; escolha múltipla sem opções também', () => {
  assert.equal(build([{ text: 'q', type: 'true_false', options: [{ text: 'a' }, { text: 'b' }, { text: 'c' }] }]).ok, false);
  assert.equal(build([{ text: 'q', type: 'true_false', options: [{ text: 'V', correct: true }, { text: 'F', correct: true }] }]).ok, false);
  assert.equal(build([{ text: 'q', type: 'multiple_choice', options: [] }]).ok, false);
  assert.equal(build([{ text: 'q', type: 'open', options: [{ text: 'x' }] }]).ok, false);
});

test('só uma questão do tipo group leva alíneas e o tipo tem de existir', () => {
  assert.equal(build([{ text: 'q', type: 'open', items: [{ text: 'a', type: 'open' }] }]).ok, false);
  assert.equal(build([{ text: 'q', type: 'banana' }]).ok, false);
});

test('rótulos das alíneas: os dados pelo cliente valem, os que faltam seguem a, b, c', () => {
  const { questions } = ok(build([{ text: 'g', type: 'group', items: [{ label: 'x', text: '1', type: 'open' }, { text: '2', type: 'open' }, { text: '3', type: 'open' }] }]));
  assert.deepEqual(questions.slice(1).map((q) => q.label), ['x', 'b', 'c']);
  assert.deepEqual([0, 25, 26].map(itemLabelAt), ['a', 'z', 'aa']);
});

test('os ids saem de sequências globais, sem repetir entre questões e opções de grupos diferentes', () => {
  const { questions } = ok(build(OGI));
  const ids = questions.map((q) => q.id);
  assert.equal(new Set(ids).size, ids.length);
  const optionIds = questions.flatMap((q) => q.options.map((o) => o.id));
  assert.equal(new Set(optionIds).size, optionIds.length);
});
