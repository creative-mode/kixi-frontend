import assert from 'node:assert/strict';
import { test } from 'node:test';
import { friendlyMessage, isRetryable, messageForStatus } from './error-messages.ts';

test('devolve português para cada estado que o backend usa', () => {
  for (const status of [400, 401, 403, 404, 408, 409, 413, 422, 429, 500, 502, 503, 418]) {
    const text = messageForStatus(status);
    assert.ok(text.length > 10, `sem texto para ${status}`);
    assert.doesNotMatch(text, /\b(not found|cannot|statement|error)\b/i);
  }
});

test('não confunde sessão expirada com falta de permissão', () => {
  assert.match(messageForStatus(401), /sessão/);
  assert.match(messageForStatus(403), /permissão/);
});

test('só deixa repetir o que pode passar sozinho', () => {
  for (const s of [0, 408, 429, 500, 503]) assert.equal(isRetryable(s), true, String(s));
  for (const s of [400, 401, 403, 404, 409, 422]) assert.equal(isRetryable(s), false, String(s));
});

test('mantém a causa exacta dos textos que já conhecemos', () => {
  assert.equal(friendlyMessage(409, 'This simulation has already been submitted'), 'Esta prova já foi entregue.');
  assert.match(friendlyMessage(403, 'You are not invited to this room'), /convidado/);
});

test('texto desconhecido em inglês cai na frase do estado, nunca é mostrado', () => {
  assert.equal(friendlyMessage(404, 'Something odd happened'), messageForStatus(404));
});

test('as mensagens em inglês do feed e das amizades saem em português (S9)', () => {
  assert.match(friendlyMessage(404, 'Class not found'), /turma não existe/);
  assert.equal(friendlyMessage(400, 'Content must have 5 to 2000 characters (optional for SIMULATION posts)'), 'O texto tem de ter entre 5 e 2000 caracteres.');
  assert.match(friendlyMessage(400, 'Account is inactive'), /conta está desativada/);
  assert.match(friendlyMessage(429, 'Too many feed requests. Try again later.'), /Espera um momento/);
});

test('amizades e bloqueio: a causa em português, sem revelar o bloqueio a quem foi bloqueado (kixi#656)', () => {
  assert.equal(friendlyMessage(409, 'Já são amigos'), 'Já são amigos.');
  assert.match(friendlyMessage(409, 'Bloqueaste esta pessoa. Desbloqueia-a antes de enviar um pedido de amizade'), /Pessoas bloqueadas/);
  // O 404 de quem me bloqueou diz o mesmo que uma pessoa que já não existe.
  const neutro = friendlyMessage(404, 'Pessoa não encontrada');
  assert.doesNotMatch(neutro, /bloque/i);
  assert.match(friendlyMessage(404, 'Post not found'), /já não existe/);
});

test('enunciado de uma prova por terminar: ainda não disponível, abre quando a prova terminar (kixi#659)', () => {
  const texto = 'Este enunciado faz parte de uma prova que ainda não terminou. As perguntas só ficam disponíveis depois de a prova terminar.';
  const msg = friendlyMessage(403, texto);
  assert.match(msg, /Ainda não está disponível/);
  assert.match(msg, /quando a prova terminar/);
});
