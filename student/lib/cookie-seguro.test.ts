import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cookieSeguro } from './cookie-seguro.ts';

test('com HTTPS atrás do proxy o cookie é Secure, em qualquer ambiente', () => {
  assert.equal(cookieSeguro('https', { NODE_ENV: 'development' }), true);
  assert.equal(cookieSeguro('https', { NODE_ENV: 'production' }), true);
});

test('em produção é Secure mesmo que o proxy não diga o protocolo', () => {
  assert.equal(cookieSeguro(null, { NODE_ENV: 'production' }), true);
  assert.equal(cookieSeguro('http', { NODE_ENV: 'production' }), true);
});

test('em desenvolvimento por HTTP não é Secure, senão o browser descartava o cookie', () => {
  assert.equal(cookieSeguro(null, { NODE_ENV: 'development' }), false);
  assert.equal(cookieSeguro('http', {}), false);
});
