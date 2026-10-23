// Testes do destino dos redirects das server actions (#479): node --test lib/action-destination.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BASE_PATH, actionDestination } from './action-destination.ts';

test('por fetch o caminho vai cru: é o cliente que lhe junta o basePath', () => {
  assert.equal(actionDestination('/login', true), '/login');
  assert.equal(actionDestination('/exams/3', true), '/exams/3');
});

test('por envio nativo do formulário o prefixo tem de vir escrito', () => {
  assert.equal(actionDestination('/login', false), `${BASE_PATH}/login`);
  assert.equal(actionDestination('/login?reason=logged-out', false), `${BASE_PATH}/login?reason=logged-out`);
  assert.equal(actionDestination('/classes?x=1', false), `${BASE_PATH}/classes?x=1`);
});

test('um caminho já prefixado não leva o prefixo duas vezes', () => {
  assert.equal(actionDestination('/manager/login', false), '/manager/login');
  assert.equal(actionDestination('/manager', false), '/manager');
});

test('um endereço absoluto (o gestor) nunca leva prefixo', () => {
  assert.equal(actionDestination('https://kixi.ao/aluno', false), 'https://kixi.ao/aluno');
  assert.equal(actionDestination('https://kixi.ao/aluno', true), 'https://kixi.ao/aluno');
});

test('BASE_PATH é o basePath do next.config.ts', () => {
  const config = readFileSync(new URL('../next.config.ts', import.meta.url), 'utf8');
  assert.match(config, new RegExp(`basePath:\\s*'${BASE_PATH}'`));
});
