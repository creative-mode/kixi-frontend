// Detecção de sessão expirada no gestor (#503): node --test lib/session-errors.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { isSessionExpiredError } from './session-errors.ts';

test('reconhece as mensagens de sessão expirada do gestor', () => {
  assert.equal(isSessionExpiredError('Sessão expirada. Inicie sessão novamente.'), true);
  assert.equal(isSessionExpiredError('Sessao expirada'), true);
  assert.equal(isSessionExpiredError('Não autenticado'), true);
  assert.equal(isSessionExpiredError('Nao autenticado'), true);
});

test('não confunde erros de permissão ou de validação com sessão expirada', () => {
  for (const msg of ['Sem permissão para esta operação.', 'Registo não encontrado.', 'Erro 500', '', null, undefined, 401]) {
    assert.equal(isSessionExpiredError(msg), false, String(msg));
  }
});
