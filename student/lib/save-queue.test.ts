import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createSaveQueue, type SendResult, type Snapshot } from './save-queue.ts';

const A: Snapshot = { optionId: 1, text: '' };
const B: Snapshot = { optionId: 2, text: '' };

function deferred() {
  let resolve!: (r: SendResult) => void;
  const promise = new Promise<SendResult>((r) => (resolve = r));
  return { promise, resolve };
}

test('dois toques seguidos numa pergunta nova: um só pedido de cada vez, o segundo já com o answerId', async () => {
  const calls: (number | null)[] = [];
  const first = deferred();
  const queue = createSaveQueue({
    send: async (_q, snap, answerId) => {
      calls.push(answerId);
      if (calls.length === 1) return first.promise;
      return { ok: true, answerId: 7 };
    },
  });

  const one = queue.request(10, A);
  const two = queue.request(10, B);
  assert.equal(calls.length, 1, 'o segundo pedido espera pelo primeiro');
  first.resolve({ ok: true, answerId: 7 });
  await Promise.all([one, two]);

  assert.deepEqual(calls, [null, 7]);
  assert.equal(queue.dirty(10, B), false);
});

test('uma rajada de toques é fundida: ganha sempre o último', async () => {
  const sent: Snapshot[] = [];
  const first = deferred();
  const queue = createSaveQueue({
    send: async (_q, snap) => {
      sent.push(snap);
      return sent.length === 1 ? first.promise : { ok: true, answerId: 1 };
    },
  });
  const p = queue.request(1, A);
  queue.request(1, { optionId: 3, text: '' });
  queue.request(1, B);
  first.resolve({ ok: true, answerId: 1 });
  await p;
  assert.deepEqual(sent.map((s) => s.optionId), [1, 2]);
});

test('não envia o que já está guardado, nem um rascunho em branco', async () => {
  let calls = 0;
  const queue = createSaveQueue({ send: async () => (calls++, { ok: true, answerId: 1 }) });
  await queue.request(1, { optionId: null, text: '   ' });
  assert.equal(calls, 0);
  await queue.request(1, A);
  await queue.request(1, A);
  assert.equal(calls, 1);
});

test('uma falha de rede é repetida, e o mapa só confia no que o servidor confirmou', async () => {
  let n = 0;
  const waits: number[] = [];
  const queue = createSaveQueue({
    send: async () => (++n < 3 ? { ok: false, message: 'rede', transient: true } : { ok: true, answerId: 5 }),
    wait: async (attempt) => void waits.push(attempt),
  });
  const p = queue.request(1, A);
  assert.equal(queue.confirmed(1), null, 'antes de confirmar não está guardada');
  await p;
  assert.deepEqual(waits, [1, 2]);
  assert.notEqual(queue.confirmed(1), null);
});

test('esgotadas as tentativas fica em erro, e retry volta a tentar', async () => {
  let up = false;
  const queue = createSaveQueue({
    send: async () => (up ? { ok: true, answerId: 2 } : { ok: false, message: 'sem rede', transient: true }),
    wait: async () => {},
    maxAttempts: 2,
  });
  await queue.request(1, A);
  assert.deepEqual(queue.failed(), [1]);
  assert.equal(queue.status(1).error, 'sem rede');
  assert.equal(queue.dirty(1, A), true);

  up = true;
  await queue.retry(1);
  assert.deepEqual(queue.failed(), []);
  assert.equal(queue.dirty(1, A), false);
});

test('uma recusa definitiva não é repetida', async () => {
  let calls = 0;
  const queue = createSaveQueue({
    send: async () => (calls++, { ok: false, message: 'recusado', transient: false }),
    wait: async () => {},
  });
  await queue.request(1, A);
  assert.equal(calls, 1);
  assert.equal(queue.status(1).status, 'error');
});

test('uma excepção do envio conta como falha transitória', async () => {
  let calls = 0;
  const queue = createSaveQueue({
    send: async () => {
      if (++calls === 1) throw new Error('fetch failed');
      return { ok: true, answerId: 1 };
    },
    wait: async () => {},
  });
  await queue.request(1, A);
  assert.equal(calls, 2);
});

test('a resposta retomada do servidor não volta a ser enviada, e mudá-la usa o answerId', async () => {
  const ids: (number | null)[] = [];
  const queue = createSaveQueue({ send: async (_q, _s, id) => (ids.push(id), { ok: true, answerId: 9 }) });
  queue.seed(1, 9, A);
  await queue.request(1, A);
  assert.deepEqual(ids, []);
  await queue.request(1, B);
  assert.deepEqual(ids, [9]);
});

test('settled() só resolve quando nada está em curso', async () => {
  const gate = deferred();
  const queue = createSaveQueue({ send: () => gate.promise });
  let settled = false;
  queue.request(1, A);
  queue.settled().then(() => (settled = true));
  await Promise.resolve();
  assert.equal(settled, false);
  gate.resolve({ ok: true, answerId: 1 });
  await queue.settled();
  assert.equal(queue.busy(), false);
});
