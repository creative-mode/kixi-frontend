import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fold, isSearchable, matchesName, normalizeQuery, uniqueBy } from './search-rules.ts';

test('a pesquisa ignora acentos e maiúsculas', () => {
  assert.equal(fold('  José  '), 'jose');
  assert.equal(matchesName('jose', 'José Manuel'), true);
  assert.equal(matchesName('JOSE', 'josé'), true);
});

test('todas as palavras têm de aparecer, por qualquer ordem', () => {
  assert.equal(matchesName('costa ana', 'Ana Maria Costa'), true);
  assert.equal(matchesName('ana pedro', 'Ana Maria Costa'), false);
});

test('uma pesquisa vazia não encontra ninguém', () => {
  assert.equal(matchesName('   ', 'Ana'), false);
});

test('só se pesquisa a partir de 2 letras', () => {
  assert.equal(isSearchable('a'), false);
  assert.equal(isSearchable('an'), true);
});

test('o parâmetro q pode vir repetido ou em falta', () => {
  assert.equal(normalizeQuery(undefined), '');
  assert.equal(normalizeQuery([' ana ', 'x']), 'ana');
  assert.equal(normalizeQuery('  itel '), 'itel');
});

test('a mesma pessoa em duas escolas aparece uma vez', () => {
  assert.deepEqual(uniqueBy([{ id: 1 }, { id: 2 }, { id: 1 }], (x) => x.id), [{ id: 1 }, { id: 2 }]);
});
