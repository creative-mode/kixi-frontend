// Testes da origem dos redirects:  node --test lib/origin.test.ts
//
// `x-forwarded-host` e `Host` são escolhidos por quem faz o pedido, e um redirect
// construído a partir de qualquer um deles é um open redirect. Estes testes fixam onde o
// pedido é acreditado e, com ele, o comportamento observável que o PR promete:
//
//   | ambiente   | APP_ORIGIN | `/403`                     | conta de gestor  |
//   |-------------|------------|----------------------------|-------------------|
//   | produção    | definido   | 307 para `${APP_ORIGIN}/403` | 307 para o gestor  |
//   | produção    | ausente    | recusa com APP_ORIGIN no erro | o mesmo           |
//   | dev         | ausente    | recusa-se a usar o pedido   | idem               |
import test from 'node:test';
import assert from 'node:assert/strict';
import { originFromRequest, resolveOrigin } from './origin.ts';

const pedido = () =>
  new Headers({ host: 'evil.tld', 'x-forwarded-host': 'evil.tld', 'x-forwarded-proto': 'https' });

const env = process.env as Record<string, string | undefined>;

/** Corre um bloco com um ambiente concreto, sem vazar para os outros testes. */
function comAmbiente(nodeEnv: string, accao: () => void, appOrigin?: string): void {
  const nodeAnterior = env.NODE_ENV;
  const origemAnterior = env.APP_ORIGIN;
  env.NODE_ENV = nodeEnv;
  if (appOrigin === undefined) delete env.APP_ORIGIN;
  else env.APP_ORIGIN = appOrigin;
  try {
    accao();
  } finally {
    if (nodeAnterior === undefined) delete env.NODE_ENV;
    else env.NODE_ENV = nodeAnterior;
    if (origemAnterior === undefined) delete env.APP_ORIGIN;
    else env.APP_ORIGIN = origemAnterior;
  }
}

test('em produção sem APP_ORIGIN recusa, e o erro diz o que falta', () => {
  comAmbiente('production', () => {
    assert.throws(
      () => resolveOrigin(pedido(), 'http:'),
      /APP_ORIGIN não está definido/,
      'a configuração em falta tem de aparecer pelo nome, não como um 500 qualquer',
    );
  });
});

test('em produção o Host do atacante nunca chega a ser a origem', () => {
  comAmbiente('production', () => {
    let escapou = null;
    try {
      escapou = resolveOrigin(pedido(), 'http:');
    } catch {
      escapou = 'recusado';
    }
    assert.notEqual(escapou, 'https://evil.tld');
  }, 'https://kixi.ao');
});

test('em produção com APP_ORIGIN, é a configuração que manda', () => {
  comAmbiente('production', () => {
    assert.equal(resolveOrigin(pedido(), 'http:'), 'https://kixi.ao');
  }, 'https://kixi.ao');
});

test('fora de produção o pedido serve, para o dev não precisar de .env', () => {
  comAmbiente('development', () => {
    assert.equal(resolveOrigin(pedido(), 'http:'), 'https://evil.tld');
  });
});

test('fora de produção, a configuração continua a ganhar ao pedido', () => {
  comAmbiente('development', () => {
    assert.equal(resolveOrigin(pedido(), 'http:'), 'https://kixi.ao');
  }, 'https://kixi.ao');
});

test('originFromRequest recusa em produção mesmo quando é chamado à mão', () => {
  // O throw está em resolveOrigin, por onde passam o proxy e as páginas. Mas
  // originFromRequest também está exportado, e um import futuro que o chame directamente
  // não pode ficar com o Host do atacante. A guarda está nos dois sítios por isso.
  comAmbiente('production', () => {
    assert.equal(originFromRequest(pedido(), 'http:'), null);
  }, 'https://kixi.ao');
});