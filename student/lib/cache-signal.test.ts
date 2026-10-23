// Testes do aviso gestor → aluno (#389): node --test lib/cache-signal.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, randomBytes } from 'node:crypto';
import { buildSignal, verifySignal } from './cache-signal.ts';

// Gerado em cada corrida: o teste não depende de nenhum segredo verdadeiro.
const key = randomBytes(32).toString('hex');

test('um aviso assinado com o segredo partilhado é aceite', () => {
  const { body, signature } = buildSignal(['subjects'], key, 1_000);
  assert.deepEqual(verifySignal(body, signature, key, 2_000), ['subjects']);
});

test('um aviso sem assinatura, com outro segredo ou alterado é recusado', () => {
  const { body, signature } = buildSignal(['subjects'], key, 1_000);
  assert.equal(verifySignal(body, null, key, 1_000), null);
  assert.equal(verifySignal(body, signature, randomBytes(32).toString('hex'), 1_000), null);
  assert.equal(verifySignal(body.replace('subjects', 'institutions'), signature, key, 1_000), null);
  assert.equal(verifySignal(body, 'nao-e-hex', key, 1_000), null);
});

test('um aviso com mais de um minuto é recusado', () => {
  const { body, signature } = buildSignal(['subjects'], key, 0);
  assert.equal(verifySignal(body, signature, key, 61_000), null);
});

test('a assinatura não é um HMAC direto do segredo partilhado: a chave é derivada', () => {
  const { body } = buildSignal(['subjects'], key, 1_000);
  const direct = createHmac('sha256', key).update(body).digest('hex');
  assert.equal(verifySignal(body, direct, key, 1_000), null);
});
