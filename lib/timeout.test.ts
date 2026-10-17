// Testes do prazo dos pedidos (#191): node --test lib/timeout.test.ts
//
// A regra que aqui se fixa é a que a issue pede: um pedido que não responde
// acaba em erro legível, não num esqueleto que fica para sempre.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ACTION_TIMEOUT_MS, REQUEST_TIMEOUT_MS, TIMEOUT_MESSAGE, isTimeout, withDeadline } from './timeout.ts';

test('um pedido que termina a tempo devolve o valor', async () => {
  assert.equal(await withDeadline(Promise.resolve(7), 1000), 7);
});

test('o prazo do cliente protege sem cortar o do servidor (#191)', () => {
  // A rede de segurança de fora tem de durar mais que o prazo de dentro: um
  // ACTION_TIMEOUT_MS mais curto que REQUEST_TIMEOUT_MS ganha sempre a corrida
  // e transforma em erro de rede um pedido que ainda ia responder a tempo.
  assert.ok(
    ACTION_TIMEOUT_MS > REQUEST_TIMEOUT_MS,
    `ACTION_TIMEOUT_MS (${ACTION_TIMEOUT_MS}) tem de ser maior que REQUEST_TIMEOUT_MS (${REQUEST_TIMEOUT_MS})`,
  );
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
