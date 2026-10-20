import assert from 'node:assert/strict';
import { test } from 'node:test';
import { forwardedFor, loginLimitMessage } from './auth-rules.ts';

test('o limite de tentativas do login diz quanto esperar', () => {
  assert.equal(loginLimitMessage(429, '61'), 'Demasiadas tentativas. Tenta de novo daqui a 2 minutos.');
  assert.equal(loginLimitMessage(429, '10'), 'Demasiadas tentativas. Tenta de novo daqui a 1 minuto.');
  assert.equal(loginLimitMessage(429, null), 'Demasiadas tentativas. Tenta de novo daqui a pouco.');
});

test('outros estados não viram a mensagem do limite', () => {
  assert.equal(loginLimitMessage(401, null), null);
  assert.equal(loginLimitMessage(503, null), null);
});

test('repassa apenas o último salto de um X-Forwarded-For válido', () => {
  assert.equal(forwardedFor('41.223.1.9, 172.18.0.9'), '172.18.0.9');
  assert.equal(forwardedFor('2a02:c207::1'), '2a02:c207::1');
  assert.equal(forwardedFor('41.223.1.9, 2001:db8::1'), '2001:db8::1');
});

test('descarta uma cadeia que contenha elementos que não são endereços IP', () => {
  assert.equal(forwardedFor('1.2.3.4\r\nX-Evil: 1'), null);
  assert.equal(forwardedFor('spoofed, 172.18.0.9'), null);
  assert.equal(forwardedFor('1.2.3.4, '), null);
  assert.equal(forwardedFor('1'.repeat(300)), null);
  assert.equal(forwardedFor(null), null);
});
