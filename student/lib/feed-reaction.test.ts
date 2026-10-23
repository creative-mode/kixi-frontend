import test from 'node:test';
import assert from 'node:assert/strict';
import { FeedReaction, type ReactionResult } from './feed-reaction.ts';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

test('sucesso usa o estado confirmado pelo servidor', async () => {
  const reaction = new FeedReaction(false, async () => ({ ok: true, reacted: true }));
  await reaction.toggle();
  assert.deepEqual(reaction.snapshot, { reacted: true, pending: false, error: null });
});

test('falha de rede reverte o optimismo e expõe erro legível com retry', async () => {
  let calls = 0;
  const targets: boolean[] = [];
  const reaction = new FeedReaction(false, async (target) => {
    calls++;
    targets.push(target);
    if (calls === 1) throw new TypeError('fetch failed');
    return { ok: true, reacted: true };
  });

  await reaction.toggle();
  assert.deepEqual(reaction.snapshot, {
    reacted: false,
    pending: false,
    error: 'Não foi possível guardar o aplauso. Verifica a ligação e tenta de novo.',
  });

  await reaction.retry();
  assert.deepEqual(reaction.snapshot, { reacted: true, pending: false, error: null });
  assert.equal(calls, 2);
  assert.deepEqual(targets, [true, true]);
});

test('retry after a lost response repeats the desired state, never a toggle', async () => {
  let serverState = false;
  let calls = 0;
  const reaction = new FeedReaction(false, async (target) => {
    calls++;
    serverState = target;
    if (calls === 1) throw new TypeError('response lost after commit');
    return { ok: true, reacted: serverState };
  });

  await reaction.toggle();
  assert.equal(serverState, true);
  await reaction.retry();
  assert.equal(serverState, true);
  assert.deepEqual(reaction.snapshot, { reacted: true, pending: false, error: null });
});

test('falha do servidor reverte o gosto e conserva a mensagem devolvida', async () => {
  const reaction = new FeedReaction(true, async () => ({ ok: false, message: 'Serviço indisponível.' }));
  await reaction.toggle();
  assert.deepEqual(reaction.snapshot, {
    reacted: true,
    pending: false,
    error: 'Serviço indisponível.',
  });
});

test('remover gosto guarda como estado confirmado o valor devolvido pelo servidor', async () => {
  const reaction = new FeedReaction(true, async () => ({ ok: true, reacted: false }));
  await reaction.toggle();
  assert.deepEqual(reaction.snapshot, { reacted: false, pending: false, error: null });
});

test('ativações concorrentes enquanto pendente partilham um pedido e não sobrescrevem a resposta', async () => {
  const response = deferred<ReactionResult>();
  let calls = 0;
  const reaction = new FeedReaction(false, () => {
    calls++;
    return response.promise;
  });

  const first = reaction.toggle();
  const second = reaction.toggle();
  assert.equal(first, second);
  assert.equal(calls, 0, 'o envio é iniciado uma vez no ciclo de microtarefas');
  assert.deepEqual(reaction.snapshot, { reacted: true, pending: true, error: null });

  response.resolve({ ok: true, reacted: true });
  await Promise.all([first, second]);
  assert.equal(calls, 1);
  assert.deepEqual(reaction.snapshot, { reacted: true, pending: false, error: null });
});

test('servidor pode confirmar um estado diferente do alvo optimista', async () => {
  const reaction = new FeedReaction(false, async () => ({ ok: true, reacted: false }));
  await reaction.toggle();
  assert.deepEqual(reaction.snapshot, { reacted: false, pending: false, error: null });
});

test('sincroniza reação confirmada quando os dados do feed são atualizados', () => {
  const reaction = new FeedReaction(false, async () => ({ ok: true, reacted: true }));
  reaction.syncConfirmed(true);
  assert.deepEqual(reaction.snapshot, { reacted: true, pending: false, error: null });
});

test('não deixa uma atualização externa sobrescrever uma alteração em curso', async () => {
  const response = deferred<ReactionResult>();
  const reaction = new FeedReaction(false, () => response.promise);
  const pending = reaction.toggle();
  reaction.syncConfirmed(false);
  assert.deepEqual(reaction.snapshot, { reacted: true, pending: true, error: null });
  response.resolve({ ok: true, reacted: true });
  await pending;
  assert.deepEqual(reaction.snapshot, { reacted: true, pending: false, error: null });
});
