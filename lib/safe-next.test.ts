// Testes da validação de destinos internos do gestor (#503): node --test lib/safe-next.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { appRelativePath, managerNext, managerPath, MANAGER_BASE_PATH } from './safe-next.ts';

test('aceita caminhos internos, com e sem o basePath', () => {
  assert.equal(managerNext('/simulations/3'), `${MANAGER_BASE_PATH}/simulations/3`);
  assert.equal(managerNext('/simulations/3?tab=notas'), `${MANAGER_BASE_PATH}/simulations/3?tab=notas`);
  assert.equal(managerNext('/manager/simulations/3'), `${MANAGER_BASE_PATH}/simulations/3`);
  assert.equal(managerNext('/manager'), `${MANAGER_BASE_PATH}/`);
  assert.equal(managerNext('/'), `${MANAGER_BASE_PATH}/`);
});

test('rejeita URLs externas e protocolos perigosos', () => {
  for (const value of [
    'https://evil.com',
    'http://evil.com/manager',
    '//evil.com',
    '///evil.com',
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'mailto:alguem@evil.com',
    '\\\\evil.com',
    '/\\evil.com',
    '/\\\\evil.com',
  ]) {
    assert.equal(managerNext(value), null, value);
  }
});

test('rejeita tentativas de escape por codificação', () => {
  for (const value of [
    '%2F%2Fevil.com',
    '/%2Fevil.com',
    '/%5Cevil.com',
    '/%255Cevil.com',
    '%252F%252Fevil.com',
    '/manager/%2e%2e/%2e%2e/login',
    '/manager%2F..%2F..%2Flogin',
  ]) {
    assert.equal(managerNext(value), null, value);
  }
});

test('rejeita rotas de autenticação, erro e API como destino', () => {
  assert.equal(managerNext('/login'), null);
  assert.equal(managerNext('/manager/login?next=/x'), null);
  assert.equal(managerNext('/403'), null);
  assert.equal(managerNext('/recuperar'), null);
  assert.equal(managerNext('/api/me'), null);
});

test('rejeita lixo, caminhos relativos e valores demasiado longos', () => {
  for (const value of [null, undefined, 42, {}, '', '   ', 'simulations/3', '?x=1', '#fragmento']) {
    assert.equal(managerNext(value), null, String(value));
  }
  assert.equal(managerNext(`/${'a'.repeat(3000)}`), null);
  assert.equal(managerNext('/manager/ok\u0000'), null);
});

test('appRelativePath tira o basePath para o router do Next', () => {
  assert.equal(appRelativePath('/manager/simulations/3?x=1', MANAGER_BASE_PATH), '/simulations/3?x=1');
  assert.equal(appRelativePath('/manager', MANAGER_BASE_PATH), '/');
  assert.equal(appRelativePath('/manager/', MANAGER_BASE_PATH), '/');
});

test('managerPath constrói o caminho público a partir do caminho do proxy', () => {
  assert.equal(managerPath('/simulations/3', '?x=1'), '/manager/simulations/3?x=1');
  assert.equal(managerPath('/'), '/manager');
});
