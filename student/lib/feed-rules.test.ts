import assert from 'node:assert/strict';
import { test } from 'node:test';
import { authorLabel, canPublish, postTypeLabel } from './feed-rules.ts';

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
