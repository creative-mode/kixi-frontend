import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  MAX_WRONG_ANSWER,
  answerTo,
  applyEvent,
  buildTurnPayload,
  describeHttpFailure,
  formatWait,
  parseQuestionNumbers,
  parseRetryAfter,
  parseSse,
  parseWrongAnswers,
  studyPrompt,
  wrongAnswersParam,
  type ChatMessage,
} from './tutor-rules.ts';

const ev = (type: string, body: object) => `event: ${type}\ndata: ${JSON.stringify({ type, ...body })}\n\n`;

test('lê os eventos completos e guarda o que ficou a meio', () => {
  const full = ev('delta', { content: 'Olá' }) + ev('delta', { content: ' mundo' });
  const cut = full.slice(0, full.length - 10);
  const first = parseSse(cut);
  assert.deepEqual(first.events, [{ type: 'delta', content: 'Olá' }]);
  const second = parseSse(first.rest + full.slice(full.length - 10));
  assert.deepEqual(second.events, [{ type: 'delta', content: ' mundo' }]);
  assert.equal(second.rest, '');
});

test('aceita \\r\\n, comentários e linhas que não são data', () => {
  const raw = ': keep-alive\r\nid: 3\r\nevent: delta\r\ndata: {"type":"delta","content":"a"}\r\n\r\n';
  assert.deepEqual(parseSse(raw).events, [{ type: 'delta', content: 'a' }]);
});

test('um evento estragado não leva os outros', () => {
  const raw = 'data: {isto não é json\n\n' + ev('delta', { content: 'x' }) + 'data: {"type":"desconhecido"}\n\n';
  assert.deepEqual(parseSse(raw).events, [{ type: 'delta', content: 'x' }]);
});

test('final e erro trazem o que o backend envia', () => {
  const sources = [{ type: 'STATEMENT', statementId: 7, questionId: null, questionNumber: null, title: 'Prova', text: 'Enunciado' }];
  const events = parseSse(ev('final', { messageId: 9, model: 'm', sources }) + ev('error', { code: 'X', message: 'y' })).events;
  assert.deepEqual(events, [
    { type: 'final', messageId: 9, model: 'm', sources },
    { type: 'error', code: 'X', message: 'y' },
  ]);
});

test('um final sem fontes é um final antigo, não um evento quebrado', () => {
  const [event] = parseSse(ev('final', { messageId: 9, model: 'm' })).events;
  assert.deepEqual(event, { type: 'final', messageId: 9, model: 'm', sources: [] });
});

test('as deltas acumulam na resposta do tutor e o final fecha-a', () => {
  let m: ChatMessage[] = [
    { id: 1, role: 'student', text: 'olá' },
    { id: 2, role: 'tutor', text: '', streaming: true },
  ];
  m = applyEvent(m, { type: 'delta', content: 'Vamos ' });
  m = applyEvent(m, { type: 'delta', content: 'por passos.' });
  assert.equal(m[1].text, 'Vamos por passos.');
  assert.equal(m[1].streaming, true);
  m = applyEvent(m, { type: 'final', messageId: 1, model: null });
  assert.equal(m[1].streaming, false);
  assert.equal(m[0].text, 'olá');
});

test('um erro a meio guarda o que chegou e diz que foi interrompida', () => {
  let m: ChatMessage[] = [{ id: 2, role: 'tutor', text: '', streaming: true }];
  m = applyEvent(m, { type: 'delta', content: 'Primeiro' });
  m = applyEvent(m, { type: 'error', code: 'BOOM', message: 'upstream' });
  assert.equal(m[0].text, 'Primeiro');
  assert.equal(m[0].streaming, false);
  assert.match(m[0].failed ?? '', /interrompida/);
});

test('sem resposta do tutor em curso, um evento não faz nada', () => {
  const m: ChatMessage[] = [{ id: 1, role: 'student', text: 'x' }];
  assert.equal(applyEvent(m, { type: 'delta', content: 'y' }), m);
});

test('429 diz quando voltar, arredondado para cima; os outros estados têm frase própria', () => {
  assert.match(describeHttpFailure(429, 61), /em 2 min/);
  assert.match(describeHttpFailure(429, null), /limite/);
  assert.match(describeHttpFailure(503, null), /não está disponível/);
  assert.match(describeHttpFailure(404, null), /já não existe/);
  assert.equal(formatWait(30), 'em 30 s');
  assert.equal(formatWait(3601), 'em 2 h');
  assert.equal(parseRetryAfter('45'), 45);
  assert.equal(parseRetryAfter('Wed, 21 Oct'), null);
  assert.equal(parseRetryAfter(null), null);
});

test('os números de questão do endereço são limpos', () => {
  assert.deepEqual(parseQuestionNumbers('3,1,3,x,-2,0,1000'), [1, 3]);
  assert.deepEqual(parseQuestionNumbers(undefined), []);
  assert.deepEqual(parseQuestionNumbers(['2,5']), [2, 5]);
  assert.equal(parseQuestionNumbers(Array.from({ length: 50 }, (_, i) => i + 1).join(',')).length, 20);
});

test('o pedido de estudar os erros lê-se bem no singular e no plural', () => {
  assert.equal(studyPrompt([]), '');
  assert.match(studyPrompt([2]), /a questão 2 desta prova/);
  assert.match(studyPrompt([1, 3]), /as questões 1 e 3 desta prova/);
  assert.match(studyPrompt([1, 2, 5]), /as questões 1, 2 e 5/);
});

test('a resposta do aluno vai com o contexto, não com o texto da mensagem', () => {
  assert.deepEqual(
    buildTurnPayload({ content: 'Porquê?', mode: 'EXPLAIN_QUESTION', questionId: 41, wrongAnswer: ' A ' }),
    { content: 'Porquê?', mode: 'EXPLAIN_QUESTION', questionId: 41, wrongAnswer: 'A' },
  );
});

test('sem contexto, o turno leva só o conteúdo e o modo', () => {
  assert.deepEqual(buildTurnPayload({ content: '  o que é TCP?  ', mode: 'CONCEPT' }), {
    content: 'o que é TCP?',
    mode: 'CONCEPT',
  });
});

test('uma resposta errada vazia não viaja: o campo é opcional', () => {
  const payload = buildTurnPayload({ content: 'x', mode: 'CONCEPT', questionId: 2, wrongAnswer: '   ' });
  assert.equal('wrongAnswer' in payload, false);
  assert.equal(payload.questionId, 2);
});

test('a resposta errada é limitada ao mesmo tamanho que o backend aceita', () => {
  const payload = buildTurnPayload({ content: 'x', mode: 'CONCEPT', wrongAnswer: 'z'.repeat(5000) });
  assert.equal((payload.wrongAnswer as string).length, MAX_WRONG_ANSWER);
});

test('o link não carrega um treatise: corta o que é contexto e o que é número', () => {
  const many = new Map(Array.from({ length: 30 }, (_, i) => [i + 1, 'z'.repeat(2000)]));
  const parsed = parseWrongAnswers(wrongAnswersParam(many).slice('&respostas='.length));
  assert.equal(parsed.size, 10);
  assert.equal(parsed.get(1)?.length, 500);
  // e o endereço não fica com dezenas de milhares de caracteres
  assert.ok(wrongAnswersParam(many).length < 12_000);
});

test('as respostas erradas sobrevivem a uma ida e volta pelo endereço', () => {
  const answers = new Map([[2, 'escolhi a opção C, porque me pareceu mais simples = 3']]);
  const param = wrongAnswersParam(answers);
  assert.ok(param.startsWith('&respostas='));
  assert.deepEqual([...parseWrongAnswers(param.slice('&respostas='.length))], [...answers]);
});

test('uma resposta com vírgula, igual ou acentos não parte o mapa ao meio', () => {
  const raw = encodeURIComponent(JSON.stringify([[3, 'a, b = c; d']]));
  assert.equal(parseWrongAnswers(raw).get(3), 'a, b = c; d');
});

test('o que vier da barra de endereços e não for um par é ignorado', () => {
  assert.equal(parseWrongAnswers('isto não é json').size, 0);
  assert.equal(parseWrongAnswers(encodeURIComponent('{"2":"A"}')).size, 0);
  const mixed = encodeURIComponent(JSON.stringify([[0, 'A'], [-1, 'B'], ['2', 'C'], [2, '  '], [4, 'D']]));
  assert.deepEqual([...parseWrongAnswers(mixed)], [[4, 'D']]);
});

test('a resposta de uma questão que o aluno não errou não é inventada', () => {
  const answers = new Map([[2, 'A']]);
  assert.equal(answerTo(answers, 2), 'A');
  assert.equal(answerTo(answers, 5), undefined);
  assert.equal(answerTo(answers, null), undefined);
});
