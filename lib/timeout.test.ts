// Testes do prazo dos pedidos (#191): node --test lib/timeout.test.ts
//
// A regra que aqui se fixa é a que a issue pede: um pedido que não responde
// acaba em erro legível, não num esqueleto que fica para sempre.
import test from 'node:test';
import assert from 'node:assert/strict';
import { TIMEOUT_MESSAGE, isTimeout, withDeadline } from './timeout.ts';

test('um pedido que termina a tempo devolve o valor', async () => {
  assert.equal(await withDeadline(Promise.resolve(7), 1000), 7);
});

test('um pedido que nunca termina acaba em timeout, não fica pendente (#191)', async () => {
  const never = new Promise<number>(() => {});
  await assert.rejects(
    () => withDeadline(never, 10),
    (e: unknown) => isTimeout(e) && (e as Error).message === TIMEOUT_MESSAGE,
  );
});

test('um erro do próprio pedido passa, não é confundido com timeout', async () => {
  await assert.rejects(
    () => withDeadline(Promise.reject(new Error('500')), 1000),
    (e: unknown) => !isTimeout(e) && (e as Error).message === '500',
  );
});

test('isTimeout só aceita um DOMException de timeout', () => {
  assert.equal(isTimeout(new DOMException('x', 'TimeoutError')), true);
  assert.equal(isTimeout(new DOMException('x', 'AbortError')), false);
  assert.equal(isTimeout(new Error(TIMEOUT_MESSAGE)), false);
  assert.equal(isTimeout(undefined), false);
});
