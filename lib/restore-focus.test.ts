// O foco volta ao botão que abriu o diálogo do gestor:  node --test lib/restore-focus.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { restoreTarget } from './restore-focus.ts';

const body = { isConnected: true, focus() {} };
const botao = (over: Record<string, unknown> = {}) => ({ isConnected: true, disabled: false, focus() {}, ...over });

test('com o foco perdido (body ou nada) volta ao botão que abriu o diálogo', () => {
  const b = botao();
  assert.equal(restoreTarget(b, body, body), b);
  assert.equal(restoreTarget(b, null, body), b);
  assert.equal(restoreTarget(b, undefined, body), b);
});

test('não contraria o foco que já está noutro controlo (clique fora do diálogo, ou o ecrã o moveu)', () => {
  assert.equal(restoreTarget(botao(), botao(), body), null);
});

test('sem gatilho utilizável não há para onde voltar: desmontado, desactivado, o body ou nenhum', () => {
  assert.equal(restoreTarget(botao({ isConnected: false }), body, body), null);
  assert.equal(restoreTarget(botao({ disabled: true }), body, body), null);
  assert.equal(restoreTarget(body, body, body), null);
  assert.equal(restoreTarget(null, body, body), null);
  assert.equal(restoreTarget(undefined, body, body), null);
});
