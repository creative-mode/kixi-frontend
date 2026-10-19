import assert from 'node:assert/strict';
import { test } from 'node:test';
import { authorOfPerson, authorView, maskName, canPublish, canPublishReflection, commentAuthorLabel, postTypeLabel, scorePercent } from './feed-rules.ts';

const ME = { name: 'Ana Silva', photo: '/me.jpg' };
const AUTHOR = { name: 'Beatriz Costa', photo: '/b.jpg', verified: false };

test('a própria publicação mostra o meu nome e a minha foto, e nunca é "colega de turma"', () => {
  const v = authorView({ authorAccountId: 3, classId: 9 }, 3, undefined, 9, ME);
  assert.deepEqual(v, { name: 'Ana Silva', photo: '/me.jpg', mine: true, verified: false, classmate: false });
});

test('a publicação de outra pessoa mostra o nome e a foto do perfil', () => {
  const v = authorView({ authorAccountId: 7, classId: 9 }, 3, AUTHOR, 4, ME);
  assert.equal(v.name, 'Beatriz Costa');
  assert.equal(v.photo, '/b.jpg');
  assert.equal(v.mine, false);
});

test('é colega de turma só quando a publicação é da mesma turma do aluno', () => {
  assert.equal(authorView({ authorAccountId: 7, classId: 9 }, 3, AUTHOR, 9, ME).classmate, true);
  assert.equal(authorView({ authorAccountId: 7, classId: 9 }, 3, AUTHOR, 4, ME).classmate, false);
  assert.equal(authorView({ authorAccountId: 7, classId: 9 }, 3, AUTHOR, null, ME).classmate, false);
});

test('sem perfil do autor, fica "Colega" e sem foto: nenhum nome é inventado', () => {
  const v = authorView({ authorAccountId: 7, classId: 9 }, 3, undefined, 9, ME);
  assert.equal(v.name, 'Colega');
  assert.equal(v.photo, null);
});

test('sem sessão, nenhuma publicação é minha', () => {
  assert.equal(authorView({ authorAccountId: 3, classId: 9 }, null, AUTHOR, 9, ME).mine, false);
});

test('um perfil verificado mantém o selo', () => {
  assert.equal(authorView({ authorAccountId: 7, classId: 9 }, 3, { ...AUTHOR, verified: true }, 9, ME).verified, true);
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

test('um perfil privado fica com o primeiro nome e a inicial do último', () => {
  assert.equal(maskName('Beatriz Maria Costa'), 'Beatriz C.');
  assert.equal(maskName('  ana   silva '), 'ana S.');
  assert.equal(maskName('Beatriz'), 'Beatriz');
  assert.equal(maskName(''), '');
});

test('um perfil restrito aparece abreviado e sem selo, mas com a foto', () => {
  const author = authorOfPerson({ displayName: 'Beatriz Maria Costa', photo: '/uploads/images/avatar/abc.png', restricted: true, verified: true });
  assert.deepEqual(author, { name: 'Beatriz C.', photo: '/uploads/images/avatar/abc.png', verified: false });
});

test('um perfil completo mostra o nome, a foto e o selo', () => {
  const author = authorOfPerson({ displayName: 'Beatriz Maria Costa', photo: 'https://exemplo.ao/b.jpg', restricted: false, verified: true });
  assert.deepEqual(author, { name: 'Beatriz Maria Costa', photo: 'https://exemplo.ao/b.jpg', verified: true });
});

test('uma foto fora dos endereços aceites cai nas iniciais', () => {
  assert.equal(authorOfPerson({ displayName: 'Ana Silva', photo: 'javascript:alert(1)', restricted: false, verified: false }).photo, null);
  assert.equal(authorOfPerson({ displayName: 'Ana Silva', photo: null, restricted: true, verified: false }).photo, null);
});
