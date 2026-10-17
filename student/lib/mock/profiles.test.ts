import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isRestricted, isVisibility, matchesSearch } from './profiles.ts';

test('só o dono vê um perfil privado por inteiro', () => {
  assert.equal(isRestricted('private', false), true);
  assert.equal(isRestricted('private', true), false);
  assert.equal(isRestricted('school', false), false);
  assert.equal(isRestricted('public', false), false);
});

test('a visibilidade só aceita os três valores do backend', () => {
  assert.ok(isVisibility('public') && isVisibility('school') && isVisibility('private'));
  assert.ok(!isVisibility('friends') && !isVisibility(undefined));
});

test('a pesquisa de escolas precisa de 2 letras e ignora maiúsculas', () => {
  const itel = { name: 'Instituto de Telecomunicações', code: 'ITEL', short_name: 'ITEL' };
  assert.equal(matchesSearch('it', itel), true);
  assert.equal(matchesSearch('I', itel), false);
  assert.equal(matchesSearch('  telecom ', itel), true);
  assert.equal(matchesSearch('xyz', itel), false);
});
