import assert from 'node:assert/strict';
import test from 'node:test';

import {
  isChoice,
  labelFor,
  move,
  optionsFor,
  optionsReady,
  problems,
  round2,
  toRequest,
  totalScore,
  unscored,
  type DraftQuestion,
} from './draft.ts';

const open = (text: string, points: number | '' = 2): DraftQuestion => ({ text, points, options: [] });
const choice = (text: string, points: number | '' = 2, correct = 0): DraftQuestion => ({
  text,
  points,
  options: [
    { label: 'A', text: 'Certa', correct: correct === 0 },
    { label: 'B', text: 'Errada', correct: correct === 1 },
  ],
});

test('uma pergunta é de escolha múltipla exatamente quando tem opções', () => {
  // ManualStatementService deduz questionType de options.isEmpty(): não há outro caminho.
  assert.equal(isChoice(open('aberta')), false);
  assert.equal(isChoice(choice('fechada')), true);
});

test('os rótulos das opções seguem A, B, C e não se reciclam', () => {
  assert.deepEqual([0, 1, 2, 3].map(labelFor), ['A', 'B', 'C', 'D']);
  // O rótulo é a identidade única da opção dentro da pergunta: um rótigo deixado
  // livre continua tomado depois de a opção ser removida.
  assert.equal(labelFor(25), 'Z');
  assert.equal(labelFor(26), '27');
});

test('uma opção sem texto impede a pergunta de estar pronta', () => {
  const q = { text: 'q', points: 2, options: [{ label: 'A', text: 'ok', correct: true }, { label: 'B', text: '  ', correct: false }] };
  assert.equal(optionsReady(q), false);
  assert.equal(optionsReady(choice('q')), true);
});

test('o total ignora a pergunta sem cotação em vez de a contar como zero', () => {
  // É o que totalScore e calculateTotalMaxScore fazem: filtram os nulos. A diferença
  // entre "sem cotação" e "zero" é o total que o enunciado vai declarar.
  assert.equal(totalScore([open('a', 2), open('b', 3)]), 5);
  assert.equal(totalScore([open('a', 2), open('b', '')]), 2);
  assert.equal(totalScore([open('a', ''), open('b', '')]), 0);
  assert.equal(unscored([open('a', ''), open('b', 3)]), 1);
});

test('o total é arredondado a duas casas, como a comparação do backend', () => {
  // A soma volta do R2DBC em double; o servidor compara com BigDecimal a 2 casas.
  assert.equal(round2(0.1 + 0.2), 0.3);
  assert.equal(totalScore([open('a', 0.1), open('b', 0.2)]), 0.3);
  assert.equal(totalScore([open('a', 1.005)]), 1.01);
});

test('o pedido manda só as perguntas com texto, sem options em perguntas abertas', () => {
  const out = toRequest([open('primeira', 2), { text: '   ', points: 2, options: [] }, choice('terceira', 1)]);
  assert.equal(out.length, 2);
  assert.deepEqual(out[0], { text: 'primeira', maxScore: 2, options: [] });
  assert.deepEqual(out[1].options, [
    { label: 'A', text: 'Certa', correct: true },
    { label: 'B', text: 'Errada', correct: false },
  ]);
});

test('o gabarito viaja no próprio pedido de criação', () => {
  // É o que o BE-08 tornou possível: ManualStatementRequest.Option.correct é honrado
  // na criação, por isso marcar a resposta certa não custa um segundo pedido.
  const [envio] = toRequest([choice('q', 2, 1)]);
  assert.equal(envio.options.filter((o) => o.correct).length, 1);
  assert.equal(envio.options[1].correct, true);
  assert.equal(envio.options[0].correct, false);
});

test('a pergunta sem texto não conta para o número que o backend atribui', () => {
  // ManualStatementService.indexed numera as perguntas que chegam, por isso uma linha
  // vazia a meio não empurra as seguintes para baixo.
  const out = toRequest([open('a', 1), { text: '', points: 1, options: [] }, choice('c', 1)]);
  assert.deepEqual(out.map((q) => q.text), ['a', 'c']);
});

test('sem gabarito o enunciado não pode ser aprovado, e o problema nomeia a questão', () => {
  const semGabarito = choice('q1', 2, 1);
  semGabarito.options = semGabarito.options.map((o) => ({ ...o, correct: false }));
  const lista = problems([open('a', 2), semGabarito]);
  assert.equal(lista.length, 1);
  assert.match(lista[0], /questão 2/);
});

test('sem cotação o enunciado avisa antes de gravar', () => {
  assert.equal(problems([open('a', 2)]).length, 0);
  assert.match(problems([open('a', '')]).join(' '), /sem cotação/);
});

test('uma pergunta aberta sem gabarito não é um problema', () => {
  // answerKeyComplete só olha para perguntas que têm opções; uma aberta não tem
  // resposta certa a marcar e nunca chumbaria a aprovação.
  assert.deepEqual(problems([open('a', 2)]), []);
});

test('opções por escrever barrem a aprovação com um aviso próprio', () => {
  const q = { text: 'q', points: 2, options: [{ label: 'A', text: '', correct: false }] };
  assert.match(problems([q]).join(' '), /opções por escrever/);
});

test('um rascunho inteiro não reporta problemas quando está correcto', () => {
  assert.deepEqual(problems([open('a', 2), choice('b', 3), choice('c', 15)]), []);
  assert.equal(totalScore([open('a', 2), choice('b', 3), choice('c', 15)]), 20);
});

test('as opções são enviadas com o texto aparado e o rótulo preenchido', () => {
  const q = { text: 'q', points: 1, options: [{ label: '', text: '  texto  ', correct: false }] };
  assert.deepEqual(optionsFor(q), [{ label: 'A', text: 'texto', correct: false }]);
});
test('mover troca o item com a vizinha e não mexe no resto', () => {
  const lista = ['a', 'b', 'c', 'd'];
  assert.deepEqual(move(lista, 1, -1), ['b', 'a', 'c', 'd']);
  assert.deepEqual(move(lista, 1, 1), ['a', 'c', 'b', 'd']);
  assert.deepEqual(move(lista, 0, 1), ['b', 'a', 'c', 'd']);
  assert.deepEqual(move(lista, 3, -1), ['a', 'b', 'd', 'c']);
});

test('mover nas pontas não faz nada, e a lista original fica intacta', () => {
  const lista = ['a', 'b', 'c'];
  assert.deepEqual(move(lista, 0, -1), lista);
  assert.deepEqual(move(lista, 2, 1), lista);
  move(lista, 0, 1);
  assert.deepEqual(lista, ['a', 'b', 'c']);
});

test('mover uma lista curta não deita fora o resto', () => {
  // A versão que primeiro escrevi devolvia `a a _ c d` ao descer da primeira: um
  // `slice` a mais partia a lista em vez de trocar dois vizinhos.
  assert.deepEqual(move(['a', 'b', 'c', 'd'], 0, 1), ['b', 'a', 'c', 'd']);
  assert.deepEqual(move(['a', 'b', 'c', 'd'], 2, 1), ['a', 'b', 'd', 'c']);
});
