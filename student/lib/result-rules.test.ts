import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  compareWithPrevious,
  formatDelta,
  formatDuration,
  formatScore,
  inOrder,
  optionTag,
  toReview,
  verdict,
  type ResultQuestion,
  showsContext,
} from './result-rules.ts';
import { wholeNumbers } from './question-number.ts';

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

// ── questões com alíneas ─────────────────────────────────────────────────────


const rq = (questionId: number, number: number, extra: Partial<ResultQuestion> = {}): ResultQuestion => ({ questionId, number, text: `Q${number}`, ...extra });
const COM_ALINEAS = [
  rq(9, 502, { parentId: 50, label: 'b', parentText: 'Dados da Q5' }), rq(4, 4), rq(1, 1), rq(3, 302, { parentId: 30, label: 'b', parentText: 'Diga V ou F' }),
  rq(2, 301, { parentId: 30, label: 'a', parentText: 'Diga V ou F' }), rq(8, 501, { parentId: 50, label: 'a', parentText: 'Dados da Q5' }),
];

test('as alíneas ficam a seguir à sua questão e não depois da última', () => {
  assert.deepEqual(inOrder(COM_ALINEAS).map((q) => q.number), [1, 301, 302, 4, 501, 502]);
});

test('o enunciado comum mostra-se uma vez, na primeira alínea de cada questão', () => {
  const lista = inOrder(COM_ALINEAS);
  assert.deepEqual(lista.map((_, i) => showsContext(lista, i)), [false, true, false, false, true, false]);
});

test('sem enunciado comum não há contexto a mostrar, e a primeira da lista mostra-o se o tiver', () => {
  assert.equal(showsContext([rq(1, 1)], 0), false);
  assert.equal(showsContext([rq(1, 301, { parentText: 'x' })], 0), true);
});

test('o tutor recebe as questões inteiras que o aluno errou', () => {
  const erradas = [rq(1, 301, { isCorrect: false }), rq(2, 302, { isCorrect: false }), rq(3, 6, { isCorrect: false })];
  assert.deepEqual(wholeNumbers(toReview(erradas)), [3, 6]);
});
