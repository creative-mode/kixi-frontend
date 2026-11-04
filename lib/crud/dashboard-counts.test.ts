// As contagens do painel num só pedido (kixi#416): node --test lib/crud/dashboard-counts.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { dashboardCountsFrom } from './dashboard-counts.ts';

const KEYS = ['subjects', 'accounts', 'review'];

test('cada chave pedida vem com a sua contagem', () => {
  assert.deepEqual(dashboardCountsFrom({ subjects: 42, accounts: 812, review: 0 }, KEYS), { subjects: 42, accounts: 812, review: 0 });
});

test('uma chave que o backend deixou de fora (a lista não é do papel) fica a -1, que o painel mostra como «!»', () => {
  assert.deepEqual(dashboardCountsFrom({ subjects: 3, review: 1 }, KEYS), { subjects: 3, accounts: -1, review: 1 });
});

test('um valor que não é um inteiro não negativo não passa por contagem', () => {
  assert.deepEqual(dashboardCountsFrom({ subjects: '3', accounts: -2, review: 1.5 }, KEYS), { subjects: -1, accounts: -1, review: -1 });
  assert.deepEqual(dashboardCountsFrom({ subjects: null, accounts: Number.NaN, review: Infinity }, KEYS), { subjects: -1, accounts: -1, review: -1 });
});

test('uma resposta que não é um objeto deixa tudo a -1, em vez de rebentar', () => {
  for (const body of [null, undefined, [], 'erro', 7]) {
    assert.deepEqual(dashboardCountsFrom(body, KEYS), { subjects: -1, accounts: -1, review: -1 });
  }
});

test('chaves que o painel não pediu são ignoradas', () => {
  assert.deepEqual(Object.keys(dashboardCountsFrom({ subjects: 1, accounts: 2, review: 3, extra: 9 }, KEYS)), KEYS);
});
