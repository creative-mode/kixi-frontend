// Testes do basePath:  node --test student/lib/paths.test.ts
//
// Estes testes existem porque o basePath lived em dois sítios ao mesmo tempo e nada
// denunciava a divergência: o `redirect()` de uma server action não o aplica, e o
// resultado era um login que acabava em 404 sem nenhuma pista de porquê.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { appPath, BASE_PATH } from './paths.ts';

const config = readFileSync(new URL('../next.config.ts', import.meta.url), 'utf8');

test('o basePath do helper e o do next.config', () => {
  const declared = config.match(/basePath:\s*'([^']*)'/)?.[1];
  assert.ok(declared, 'nao encontrei basePath no next.config.ts');
  assert.equal(BASE_PATH, declared);
});

test('appPath junta o prefixo', () => {
  assert.equal(appPath('/inicio'), '/aluno/inicio');
  assert.equal(appPath('inicio'), '/aluno/inicio');
});

test('appPath nao toca numa query', () => {
  assert.equal(appPath('/entrar?reason=logged-out'), '/aluno/entrar?reason=logged-out');
});

test('appPath nao duplica o prefixo se ja la estiver', () => {
  // Erro facil de cometer ao corrigir um redirect() a mao: /aluno/aluno/entrar, que da 404.
  assert.equal(appPath('/aluno/entrar'), '/aluno/entrar');
  assert.equal(appPath(appPath('/entrar')), '/aluno/entrar');
  assert.equal(appPath('/aluno'), '/aluno');
});
