// Testes da cache dos dados de referência do gestor (#389): node --test lib/crud/ref-cache.test.ts
//
// O que aqui se fixa: um utilizador nunca recebe a entrada de outro, uma escrita esquece a etiqueta
// para todos, e o que falhou ou chegou depois de uma escrita não fica guardado.
import test from 'node:test';
import assert from 'node:assert/strict';
import { RefCache } from './ref-cache.ts';

const loader = (value: string, keep = true) => {
  let calls = 0;
  return { load: async () => { calls++; return { value, keep }; }, calls: () => calls };
};

test('a segunda leitura do mesmo utilizador não volta ao backend', async () => {
  const cache = new RefCache<string>(60_000, 10);
  const subjects = loader('disciplinas');
  assert.equal(await cache.remember('ana', '/subjects', ['subjects'], subjects.load), 'disciplinas');
  assert.equal(await cache.remember('ana', '/subjects', ['subjects'], subjects.load), 'disciplinas');
  assert.equal(subjects.calls(), 1);
});

test('a entrada de um utilizador nunca serve outro', async () => {
  const cache = new RefCache<string>(60_000, 10);
  await cache.remember('professor', '/classes', ['classes'], loader('turmas do professor').load);
  const admin = loader('todas as turmas');
  assert.equal(await cache.remember('admin', '/classes', ['classes'], admin.load), 'todas as turmas');
  assert.equal(admin.calls(), 1);
});

test('leituras iguais em curso juntam-se numa só', async () => {
  const cache = new RefCache<string>(60_000, 10);
  const subjects = loader('disciplinas');
  const [a, b] = await Promise.all([
    cache.remember('ana', '/subjects', ['subjects'], subjects.load),
    cache.remember('ana', '/subjects', ['subjects'], subjects.load),
  ]);
  assert.equal(a, b);
  assert.equal(subjects.calls(), 1);
});

test('uma escrita esquece a etiqueta para todos os utilizadores e deixa as outras', async () => {
  const cache = new RefCache<string>(60_000, 10);
  await cache.remember('ana', '/subjects', ['subjects'], loader('a').load);
  await cache.remember('rui', '/subjects', ['subjects'], loader('b').load);
  await cache.remember('ana', '/terms', ['terms'], loader('c').load);
  cache.forget('subjects');
  assert.equal(cache.size, 1);
  const fresh = loader('nova');
  assert.equal(await cache.remember('rui', '/subjects', ['subjects'], fresh.load), 'nova');
  assert.equal(fresh.calls(), 1);
});

test('uma leitura que começou antes de uma escrita não guarda o valor antigo', async () => {
  const cache = new RefCache<string>(60_000, 10);
  let release!: () => void;
  const slow = cache.remember('ana', '/subjects', ['subjects'], () => new Promise((resolve) => {
    release = () => resolve({ value: 'antes da escrita', keep: true });
  }));
  cache.forget('subjects');
  release();
  assert.equal(await slow, 'antes da escrita');
  assert.equal(cache.size, 0);
  const after = loader('depois da escrita');
  assert.equal(await cache.remember('ana', '/subjects', ['subjects'], after.load), 'depois da escrita');
  assert.equal(after.calls(), 1);
});

test('o que falhou não fica guardado', async () => {
  const cache = new RefCache<string>(60_000, 10);
  await cache.remember('ana', '/subjects', ['subjects'], loader('erro', false).load);
  assert.equal(cache.size, 0);
});

test('uma entrada fora do prazo volta ao backend', async () => {
  let now = 0;
  const cache = new RefCache<string>(1_000, 10, () => now);
  const subjects = loader('disciplinas');
  await cache.remember('ana', '/subjects', ['subjects'], subjects.load);
  now = 1_500;
  await cache.remember('ana', '/subjects', ['subjects'], subjects.load);
  assert.equal(subjects.calls(), 2);
});

test('não cresce além do limite: sai a entrada mais antiga', async () => {
  const cache = new RefCache<string>(60_000, 2);
  await cache.remember('a', '/subjects', ['subjects'], loader('1').load);
  await cache.remember('b', '/subjects', ['subjects'], loader('2').load);
  await cache.remember('c', '/subjects', ['subjects'], loader('3').load);
  assert.equal(cache.size, 2);
  const again = loader('1 outra vez');
  await cache.remember('a', '/subjects', ['subjects'], again.load);
  assert.equal(again.calls(), 1);
});
