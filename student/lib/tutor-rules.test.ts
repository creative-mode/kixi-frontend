import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  applyEvent,
  describeHttpFailure,
  formatWait,
  parseQuestionNumbers,
  parseRetryAfter,
  parseSse,
  studyPrompt,
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
  const events = parseSse(ev('final', { messageId: 9, model: 'm' }) + ev('error', { code: 'X', message: 'y' })).events;
  assert.deepEqual(events, [
    { type: 'final', messageId: 9, model: 'm' },
    { type: 'error', code: 'X', message: 'y' },
  ]);
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
