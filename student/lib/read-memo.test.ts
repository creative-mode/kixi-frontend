import test from 'node:test';
import assert from 'node:assert/strict';
import { ReadMemo } from './read-memo.ts';
import { TtlCache } from './ttl-cache.ts';

test('duas leituras iguais no mesmo pedido fazem uma só ida ao backend', async () => {
  const memo = new ReadMemo();
  let calls = 0;
  const load = async () => { calls++; return [1, 2, 3]; };
  const [a, b] = await Promise.all([memo.read('/simulations', load), memo.read('/simulations', load)]);
  assert.deepEqual(a, b);
  assert.equal(calls, 1);
  assert.equal(memo.size, 1);
});

test('cada leitor recebe a sua cópia: ordenar no sítio não estraga a de outro', async () => {
  const memo = new ReadMemo();
  const load = async () => [3, 1, 2];
  const first = await memo.read('k', load);
  first.sort();
  assert.deepEqual(await memo.read('k', load), [3, 1, 2]);
});

test('uma escrita esvazia a memória e a leitura seguinte vê o que se escreveu', async () => {
  const memo = new ReadMemo();
  let value = 'antes';
  const load = async () => value;
  assert.equal(await memo.read('k', load), 'antes');
  value = 'depois';
  assert.equal(await memo.read('k', load), 'antes');
  memo.clear();
  assert.equal(await memo.read('k', load), 'depois');
});

test('endereços diferentes são leituras diferentes', async () => {
  const memo = new ReadMemo();
  await memo.read('/a', async () => 1);
  await memo.read('/b', async () => 2);
  assert.equal(memo.size, 2);
});

test('a cache guarda até ao prazo e depois volta a ler', async () => {
  let t = 0;
  const cache = new TtlCache<string>(1000, 10, () => t);
  let calls = 0;
  const load = async () => { calls++; return { value: `v${calls}`, keep: true }; };
  assert.equal(await cache.remember('k', load), 'v1');
  t = 999;
  assert.equal(await cache.remember('k', load), 'v1');
  t = 1001;
  assert.equal(await cache.remember('k', load), 'v2');
  assert.equal(calls, 2);
});

test('o que falhou não fica guardado', async () => {
  const cache = new TtlCache<string>(1000, 10);
  let calls = 0;
  const load = async () => { calls++; return { value: 'vazio', keep: false }; };
  await cache.remember('k', load);
  await cache.remember('k', load);
  assert.equal(calls, 2);
  assert.equal(cache.size, 0);
});

test('pedidos iguais em curso juntam-se numa só leitura', async () => {
  const cache = new TtlCache<number>(1000, 10);
  let calls = 0;
  const load = async () => { calls++; await new Promise((r) => setTimeout(r, 5)); return { value: 7, keep: true }; };
  const all = await Promise.all([cache.remember('k', load), cache.remember('k', load), cache.remember('k', load)]);
  assert.deepEqual(all, [7, 7, 7]);
  assert.equal(calls, 1);
});

test('a cache tem limite: ao encher, sai a entrada mais antiga', async () => {
  const cache = new TtlCache<number>(1000, 2);
  for (const k of ['a', 'b', 'c']) await cache.remember(k, async () => ({ value: 1, keep: true }));
  assert.equal(cache.size, 2);
  let calls = 0;
  await cache.remember('a', async () => { calls++; return { value: 1, keep: true }; });
  assert.equal(calls, 1, 'a, a mais antiga, saiu');
});
