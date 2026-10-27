import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FonteDeToken, configuracaoDoAmbiente } from './token.ts';

const cfg = { url: 'https://id.exemplo/token', clientId: 'gestor', clientSecret: 'segredo' };

function falso(respostas: Array<{ status?: number; corpo: unknown }>) {
  const chamadas: { url: string; corpo: string }[] = [];
  const f = (async (url: string, init: RequestInit) => {
    chamadas.push({ url, corpo: String(init.body) });
    const r = respostas.shift()!;
    return new Response(JSON.stringify(r.corpo), { status: r.status ?? 200 });
  }) as unknown as typeof fetch;
  return { f, chamadas };
}

test('pede o token por client credentials e guarda-o até perto de expirar', async () => {
  let t = 0;
  const { f, chamadas } = falso([{ corpo: { access_token: 'a', expires_in: 300 } }, { corpo: { access_token: 'b', expires_in: 300 } }]);
  const fonte = new FonteDeToken(cfg, f, () => t);
  assert.equal(await fonte.obter(), 'a');
  assert.equal(await fonte.obter(), 'a');
  assert.equal(chamadas.length, 1);
  assert.match(chamadas[0].corpo, /grant_type=client_credentials/);
  t = 280_000; // faltam 20 s: dentro da margem
  assert.equal(await fonte.obter(), 'b');
  assert.equal(chamadas.length, 2);
});

test('pedidos em simultâneo partilham o mesmo pedido ao fornecedor', async () => {
  const { f, chamadas } = falso([{ corpo: { access_token: 'a', expires_in: 300 } }]);
  const fonte = new FonteDeToken(cfg, f, () => 0);
  assert.deepEqual(await Promise.all([fonte.obter(), fonte.obter(), fonte.obter()]), ['a', 'a', 'a']);
  assert.equal(chamadas.length, 1);
});

test('invalidar obriga a pedir de novo', async () => {
  const { f, chamadas } = falso([{ corpo: { access_token: 'a', expires_in: 300 } }, { corpo: { access_token: 'b', expires_in: 300 } }]);
  const fonte = new FonteDeToken(cfg, f, () => 0);
  await fonte.obter();
  fonte.invalidar();
  assert.equal(await fonte.obter(), 'b');
  assert.equal(chamadas.length, 2);
});

test('um erro do fornecedor não repete o corpo do pedido e o pedido seguinte tenta de novo', async () => {
  const { f } = falso([{ status: 401, corpo: { error: 'segredo' } }, { corpo: { access_token: 'a', expires_in: 300 } }]);
  const fonte = new FonteDeToken(cfg, f, () => 0);
  await assert.rejects(fonte.obter(), (e: Error) => e.message.includes('401') && !e.message.includes('segredo'));
  assert.equal(await fonte.obter(), 'a');
});

test('sem as três variáveis não há client credentials', () => {
  assert.equal(configuracaoDoAmbiente({ SCHOOLOPS_CAMUNDA_TOKEN_URL: 'x', SCHOOLOPS_CAMUNDA_CLIENT_ID: 'y' }), null);
  assert.deepEqual(
    configuracaoDoAmbiente({ SCHOOLOPS_CAMUNDA_TOKEN_URL: 'u', SCHOOLOPS_CAMUNDA_CLIENT_ID: 'i', SCHOOLOPS_CAMUNDA_CLIENT_SECRET: 's' }),
    { url: 'u', clientId: 'i', clientSecret: 's', audiencia: undefined },
  );
});
