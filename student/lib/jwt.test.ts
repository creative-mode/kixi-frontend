import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { test } from 'node:test';
import { SignJWT } from 'jose';
import { verificarSessao } from './jwt.ts';

const SEGREDO = 'segredo-de-teste-com-pelo-menos-32-caracteres';
const ENV = { JWT_SECRET: SEGREDO, KIXI_MOCK: 'false' };
const chave = (s: string) => new TextEncoder().encode(s);

async function token(claims: Record<string, unknown>, { segredo = SEGREDO, alg = 'HS256', exp = '1h' as string | number } = {}) {
  return new SignJWT(claims).setProtectedHeader({ alg }).setSubject('42').setIssuedAt().setExpirationTime(exp).sign(chave(segredo));
}

test('um token bem assinado dá a sessão, em HS256 e em HS384 (o backend assina pelo tamanho do segredo)', async () => {
  for (const alg of ['HS256', 'HS384', 'HS512']) {
    const s = await verificarSessao(await token({ roles: ['STUDENT'] }, { alg }), ENV);
    assert.equal(s?.accountId, 42, alg);
    assert.deepEqual(s?.roles, ['STUDENT'], alg);
  }
});

test('um cookie forjado com outro segredo não dá sessão, mesmo com papéis válidos', async () => {
  assert.equal(await verificarSessao(await token({ roles: ['ADMIN'] }, { segredo: 'outro-segredo-com-mais-de-32-caracteres!!' }), ENV), null);
});

test('alterar o corpo de um token assinado invalida-o', async () => {
  const [cabecalho, , assinatura] = (await token({ roles: ['STUDENT'] })).split('.');
  const corpo = Buffer.from(JSON.stringify({ sub: '42', roles: ['ADMIN'], exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url');
  assert.equal(await verificarSessao(`${cabecalho}.${corpo}.${assinatura}`, ENV), null);
});

test('um token expirado não dá sessão', async () => {
  assert.equal(await verificarSessao(await token({ roles: ['STUDENT'] }, { exp: Math.floor(Date.now() / 1000) - 60 }), ENV), null);
});

test('alg none e algoritmos fora de HS* são recusados', async () => {
  const b64 = (v: object) => Buffer.from(JSON.stringify(v)).toString('base64url');
  const corpo = { sub: '42', roles: ['ADMIN'], exp: Math.floor(Date.now() / 1000) + 3600 };
  assert.equal(await verificarSessao(`${b64({ alg: 'none', typ: 'JWT' })}.${b64(corpo)}.`, ENV), null);
  const cab = b64({ alg: 'RS256', typ: 'JWT' });
  const sig = createHmac('sha256', SEGREDO).update(`${cab}.${b64(corpo)}`).digest('base64url');
  assert.equal(await verificarSessao(`${cab}.${b64(corpo)}.${sig}`, ENV), null);
});

test('sem papéis, sem token ou com lixo não há sessão', async () => {
  assert.equal(await verificarSessao(await token({ roles: [] }), ENV), null);
  assert.equal(await verificarSessao(await token({}), ENV), null);
  assert.equal(await verificarSessao(undefined, ENV), null);
  assert.equal(await verificarSessao('isto.nao.e-um-jwt', ENV), null);
});

test('um segredo mal configurado rebenta em vez de passar por "ninguém tem sessão"', async () => {
  await assert.rejects(verificarSessao(await token({ roles: ['STUDENT'] }), { KIXI_MOCK: 'false' }), /JWT_SECRET/);
});
