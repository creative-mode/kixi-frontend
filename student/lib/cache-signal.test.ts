// Testes do aviso gestor → aluno (#389): node --test lib/cache-signal.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSignal, verifySignal } from './cache-signal.ts';

const SECRET = 'um-segredo-de-teste-com-mais-de-32-caracteres';

test('um aviso assinado com o segredo partilhado é aceite', () => {
  const { body, signature } = buildSignal(['subjects'], SECRET, 1_000);
  assert.deepEqual(verifySignal(body, signature, SECRET, 2_000), ['subjects']);
});

test('um aviso sem assinatura, com outro segredo ou alterado é recusado', () => {
  const { body, signature } = buildSignal(['subjects'], SECRET, 1_000);
  assert.equal(verifySignal(body, null, SECRET, 1_000), null);
  assert.equal(verifySignal(body, signature, 'outro-segredo-com-mais-de-32-caracteres!!', 1_000), null);
  assert.equal(verifySignal(body.replace('subjects', 'institutions'), signature, SECRET, 1_000), null);
  assert.equal(verifySignal(body, 'nao-e-hex', SECRET, 1_000), null);
});

test('um aviso com mais de um minuto é recusado', () => {
  const { body, signature } = buildSignal(['subjects'], SECRET, 0);
  assert.equal(verifySignal(body, signature, SECRET, 61_000), null);
});
