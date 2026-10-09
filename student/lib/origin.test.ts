// Testes da origem dos redirects:  node --test student/lib/origin.test.ts
//
// O bug que estes testes apanham: em produção, sem APP_ORIGIN, um `Host: evil.tld`
// fazia os redirects apontarem para o atacante (open redirect). A origem passa a ser
// só configuração em produção; sem ela, os chamadores degradam para relativo.
import test from 'node:test';
import assert from 'node:assert/strict';
import { appOrigin, originFromRequest, resolveOrigin } from './origin.ts';

const evil = () =>
  new Headers({ host: 'evil.tld', 'x-forwarded-host': 'evil.tld', 'x-forwarded-proto': 'https' });

function withEnv(env: Record<string, string | undefined>, run: () => void) {
  const previous = { ...process.env };
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    run();
  } finally {
    process.env = previous;
  }
}

test('em produção e sem APP_ORIGIN, o pedido é recusado', () => {
  withEnv({ NODE_ENV: 'production', APP_ORIGIN: undefined }, () => {
    assert.equal(resolveOrigin(evil(), 'http'), null);
  });
});

test('em produção com APP_ORIGIN, a configuração vence o pedido', () => {
  withEnv({ NODE_ENV: 'production', APP_ORIGIN: 'https://kixi.ao' }, () => {
    assert.equal(resolveOrigin(evil(), 'http'), 'https://kixi.ao');
    assert.equal(appOrigin(), 'https://kixi.ao');
  });
});

test('fora de produção mantém-se o comportamento actual (dev sem .env)', () => {
  withEnv({ NODE_ENV: 'development', APP_ORIGIN: undefined }, () => {
    assert.equal(resolveOrigin(evil(), 'http'), 'https://evil.tld');
  });
});

test('originFromRequest continua a existir só como recurso de desenvolvimento', () => {
  assert.equal(originFromRequest(evil(), 'http'), 'https://evil.tld');
  assert.equal(originFromRequest(new Headers(), 'http'), null);
});
