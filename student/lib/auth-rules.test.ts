import assert from 'node:assert/strict';
import { test } from 'node:test';
import { authFailureMessage, forwardedFor, retryAfterSeconds } from './auth-rules.ts';

test('uma conta repetida diz-se em português, sem revelar se foi o utilizador ou o email', () => {
  const message = authFailureMessage('/auth/register', 409, null);
  assert.match(message ?? '', /já tem conta/);
  assert.doesNotMatch(message ?? '', /Username|email already/i);
});

test('o 409 de outro caminho não vira "já tem conta"', () => {
  assert.equal(authFailureMessage('/auth/login', 409, null), null);
});

test('o limite de tentativas diz quanto esperar, arredondado para cima', () => {
  assert.equal(authFailureMessage('/auth/login', 429, 61), 'Demasiadas tentativas. Tenta de novo daqui a 2 minutos.');
  assert.equal(authFailureMessage('/auth/register', 429, 30), 'Demasiadas tentativas. Tenta de novo daqui a 1 minuto.');
  assert.equal(authFailureMessage('/auth/register', 429, null), 'Demasiadas tentativas. Tenta de novo daqui a pouco.');
});

test('o 503 não mostra o texto técnico do servidor', () => {
  assert.doesNotMatch(authFailureMessage('/auth/register', 503, null) ?? '', /protection|Registration/i);
});

test('um erro sem mensagem melhor deixa a do servidor passar', () => {
  assert.equal(authFailureMessage('/auth/register', 400, null), null);
});

test('Retry-After só vale como número positivo de segundos', () => {
  assert.equal(retryAfterSeconds('120'), 120);
  assert.equal(retryAfterSeconds('0'), null);
  assert.equal(retryAfterSeconds('amanhã'), null);
  assert.equal(retryAfterSeconds(null), null);
});

test('só se repassa um X-Forwarded-For que seja uma lista de IPs', () => {
  assert.equal(forwardedFor('41.223.1.9'), '41.223.1.9');
  assert.equal(forwardedFor('41.223.1.9, 172.18.0.9'), '41.223.1.9, 172.18.0.9');
  assert.equal(forwardedFor('2a02:c207::1'), '2a02:c207::1');
});

test('um X-Forwarded-For com texto livre, quebras de linha ou demasiado longo é descartado', () => {
  assert.equal(forwardedFor('1.2.3.4\r\nX-Evil: 1'), null);
  assert.equal(forwardedFor('1.2.3.4; DROP'), null);
  assert.equal(forwardedFor('1'.repeat(300)), null);
  assert.equal(forwardedFor(''), null);
  assert.equal(forwardedFor(null), null);
});
