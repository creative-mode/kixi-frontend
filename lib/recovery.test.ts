// Recuperação de palavra-passe do gestor (#503): node --test lib/recovery.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { managerRecoveryMessage, MANAGER_RECOVERY_MESSAGE } from './recovery.ts';

test('a resposta é neutra e igual para qualquer identificador', () => {
  const valores = ['', 'admin@kixi.ao', 'nao-existe@kixi.ao', '12345', '  '];
  for (const valor of valores) {
    assert.equal(managerRecoveryMessage(valor), MANAGER_RECOVERY_MESSAGE);
  }
});

test('a resposta não revela existência de conta e indica a escola', () => {
  const texto = MANAGER_RECOVERY_MESSAGE.toLowerCase();
  assert.doesNotMatch(texto, /conta (existe|não existe)|email enviado|enviamos|link enviado/);
  assert.match(texto, /escola|professor|secretaria/);
});
