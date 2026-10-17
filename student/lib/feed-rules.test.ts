import assert from 'node:assert/strict';
import { test } from 'node:test';
import { authorLabel, canPublish, canPublishReflection, commentAuthorLabel, postTypeLabel, scorePercent } from './feed-rules.ts';

test('a própria conta é "Tu", outra conta é um colega sem nome', () => {
  assert.equal(authorLabel(3, 3), 'Tu');
  assert.equal(authorLabel(7, 3), 'Um colega da turma');
});

test('sem sessão (myAccountId null), nunca se afirma que é "Tu"', () => {
  assert.equal(authorLabel(3, null), 'Um colega da turma');
});

test('tipos conhecidos têm rótulo em português; um tipo novo mostra-se tal como vem', () => {
  assert.equal(postTypeLabel('doubt'), 'Dúvida');
  assert.equal(postTypeLabel('topic'), 'Tema');
  assert.equal(postTypeLabel('future_type'), 'future_type');
});

test('publicar exige pelo menos 5 caracteres depois de aparar espaços', () => {
  assert.equal(canPublish('abcd'), false);
  assert.equal(canPublish('   abcd   '), false);
  assert.equal(canPublish('abcde'), true);
});

test('publicar recusa mais de 2000 caracteres', () => {
  assert.equal(canPublish('a'.repeat(2001)), false);
  assert.equal(canPublish('a'.repeat(2000)), true);
});

test('o cartão de uma prova simulada tem rótulo próprio', () => {
  assert.equal(postTypeLabel('simulation'), 'Prova simulada');
});

test('a reflexão que acompanha o resultado é opcional, mas tem o mesmo limite', () => {
  assert.equal(canPublishReflection(''), true);
  assert.equal(canPublishReflection('a'.repeat(2000)), true);
  assert.equal(canPublishReflection('a'.repeat(2001)), false);
});

test('num comentário, o próprio é "Tu" mesmo sem nome no perfil', () => {
  assert.equal(commentAuthorLabel(null, true), 'Tu');
  assert.equal(commentAuthorLabel('Nuno D.', true), 'Tu');
});

test('num comentário de outro, o nome mascarado; sem perfil, "Colega"', () => {
  assert.equal(commentAuthorLabel('Nuno D.', false), 'Nuno D.');
  assert.equal(commentAuthorLabel(null, false), 'Colega');
  assert.equal(commentAuthorLabel('   ', false), 'Colega');
  assert.equal(commentAuthorLabel(undefined, false), 'Colega');
});

test('a percentagem só existe com nota e cotação positiva', () => {
  assert.equal(scorePercent(14.5, 20), 73);
  assert.equal(scorePercent(null, 20), null);
  assert.equal(scorePercent(10, null), null);
  assert.equal(scorePercent(10, 0), null);
});
