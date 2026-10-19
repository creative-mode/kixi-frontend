import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isRestricted, isVisibility, matchesSearch, personAttributes } from './profiles.ts';

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

test('o kind de um professor vem em minúsculas, nunca "TEACHER"', () => {
  const stats = { level: 3, xp: 240, badges: ['Primeira prova'] };
  assert.equal(personAttributes(true, stats, 'Redes').kind, 'teacher');
  assert.equal(personAttributes(false, stats, 'Redes').kind, 'student');
});

test('um professor não tem XP nem medalhas — mostra a especialidade em vez disso', () => {
  const stats = { level: 3, xp: 240, badges: ['Primeira prova'] };
  const teacher = personAttributes(true, stats, 'Redes');
  assert.deepEqual(teacher, { kind: 'teacher', level: null, xp: null, badges: [], specialty: 'Redes' });
});

test('um aluno tem XP e medalhas, mas nunca especialidade', () => {
  const stats = { level: 3, xp: 240, badges: ['Primeira prova'] };
  const student = personAttributes(false, stats, 'Redes');
  assert.deepEqual(student, { kind: 'student', level: 3, xp: 240, badges: ['Primeira prova'], specialty: null });
});

test('a pesquisa de escolas precisa de 2 letras e ignora maiúsculas', () => {
  const itel = { name: 'Instituto de Telecomunicações', code: 'ITEL', short_name: 'ITEL' };
  assert.equal(matchesSearch('it', itel), true);
  assert.equal(matchesSearch('I', itel), false);
  assert.equal(matchesSearch('  telecom ', itel), true);
  assert.equal(matchesSearch('xyz', itel), false);
});
