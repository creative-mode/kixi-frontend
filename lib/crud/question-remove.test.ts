// node --test lib/crud/question-remove.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { removeQuestionBlock } from './question-remove.ts';

const ok = async () => ({ ok: true as const });

test('remove tudo quando nenhum DELETE falha', async () => {
  const seen: number[] = [];
  const res = await removeQuestionBlock([7, 701, 702], async (id) => {
    seen.push(id);
    return ok();
  });
  assert.deepEqual(res, { ok: true, removed: [7, 701, 702] });
  assert.deepEqual(seen, [7, 701, 702]);
});

test('falha no segundo DELETE: para, sem sucesso, e diz o que saiu (#170)', async () => {
  const seen: number[] = [];
  const res = await removeQuestionBlock([7, 701, 702], async (id) => {
    seen.push(id);
    return id === 701 ? { ok: false as const, error: 'Falha de rede' } : ok();
  });
  assert.deepEqual(res, { ok: false, removed: [7], failedId: 701, error: 'Falha de rede' });
  // o terceiro nunca é tentado: sem efeito colateral depois da falha
  assert.deepEqual(seen, [7, 701]);
});

test('falha no primeiro DELETE: nada sai', async () => {
  const res = await removeQuestionBlock([7, 701], async () => ({ ok: false as const, error: 'Proibido' }));
  assert.deepEqual(res, { ok: false, removed: [], failedId: 7, error: 'Proibido' });
});

test('bloco vazio é sucesso vazio', async () => {
  assert.deepEqual(await removeQuestionBlock([], ok), { ok: true, removed: [] });
});
