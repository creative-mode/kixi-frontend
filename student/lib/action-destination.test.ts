// Testes do destino dos redirects das server actions (#479): node --test lib/action-destination.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BASE_PATH, actionDestination } from './action-destination.ts';

test('por fetch o caminho vai cru: é o cliente que lhe junta o basePath', () => {
  assert.equal(actionDestination('/inicio', true), '/inicio');
  assert.equal(actionDestination('/prova/3?iniciada=1', true), '/prova/3?iniciada=1');
});

test('por envio nativo do formulário o prefixo tem de vir escrito', () => {
  assert.equal(actionDestination('/inicio', false), `${BASE_PATH}/inicio`);
  assert.equal(actionDestination('/entrar?reason=logged-out', false), `${BASE_PATH}/entrar?reason=logged-out`);
  assert.equal(actionDestination('/resultado?prova=4&submetida=1', false), `${BASE_PATH}/resultado?prova=4&submetida=1`);
});

test('um caminho já prefixado não leva o prefixo duas vezes', () => {
  assert.equal(actionDestination('/aluno/inicio', false), '/aluno/inicio');
  assert.equal(actionDestination('/aluno', false), '/aluno');
});

test('um endereço absoluto (o gestor) nunca leva prefixo', () => {
  assert.equal(actionDestination('https://kixi.ao/manager', false), 'https://kixi.ao/manager');
  assert.equal(actionDestination('https://kixi.ao/manager', true), 'https://kixi.ao/manager');
});

test('BASE_PATH é o basePath do next.config.ts', () => {
  const config = readFileSync(new URL('../next.config.ts', import.meta.url), 'utf8');
  assert.match(config, new RegExp(`basePath:\\s*'${BASE_PATH}'`));
});
