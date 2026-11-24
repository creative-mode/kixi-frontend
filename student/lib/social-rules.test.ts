import assert from 'node:assert/strict';
import { test } from 'node:test';
import { groupBySubject, ownPosts, profileTabOf, shortTitle } from './social-rules.ts';

test('agrupa por disciplina, da mais frequente para a menos, ignorando as sem nome', () => {
  const rows = groupBySubject([{ subject: 'Física' }, { subject: 'OGI' }, { subject: 'Física' }, { subject: '  ' }, { subject: null }, {}]);
  assert.deepEqual(rows, [{ name: 'Física', count: 2 }, { name: 'OGI', count: 1 }]);
});

test('desempata por ordem alfabética e respeita o limite', () => {
  const rows = groupBySubject([{ subject: 'B' }, { subject: 'A' }, { subject: 'C' }], 2);
  assert.deepEqual(rows.map((r) => r.name), ['A', 'B']);
});

test('só fica com as publicações da própria conta', () => {
  const posts = [{ id: 1, authorAccountId: 3 }, { id: 2, authorAccountId: 9 }, { id: 3, authorAccountId: 3 }];
  assert.deepEqual(ownPosts(posts, 3).map((p) => p.id), [1, 3]);
  assert.deepEqual(ownPosts(posts, null), []);
});

test('um título curto fica como está e um comprido corta nas palavras', () => {
  assert.equal(shortTitle('Teste de Física'), 'Teste de Física');
  const cut = shortTitle('Prova de Exame OGI 12ª Classe - Série B - 2024/2025', 24);
  assert.ok(cut.endsWith('…') && cut.length <= 24, cut);
  assert.ok(!cut.includes('  '));
});

test('o separador do perfil vem do endereço só se existir', () => {
  assert.equal(profileTabOf('Conquistas'), 'Conquistas');
  assert.equal(profileTabOf('Medalhas'), 'Conquistas');
  assert.equal(profileTabOf(['Histórico', 'x']), 'Conquistas');
  assert.equal(profileTabOf('hack'), 'Publicações');
  assert.equal(profileTabOf(undefined), 'Publicações');
});

test('«Adicionar» não aparece a quem é de outra escola nem a quem se bloqueou (S10, S17)', async () => {
  const { podePedirAmizade, restrictedNotice } = await import('./social-rules.ts');
  const base = { teacher: false, signedIn: true, blocked: false, restricted: false, visibility: 'public', schoolIds: [1], mySchoolId: 1 };
  assert.equal(podePedirAmizade(base), true);
  assert.equal(podePedirAmizade({ ...base, schoolIds: [2] }), false, 'outra escola');
  assert.equal(podePedirAmizade({ ...base, restricted: true, visibility: 'school', schoolIds: [] }), false, 'restrito a uma escola que não é a minha');
  assert.equal(podePedirAmizade({ ...base, blocked: true }), false, 'bloqueado');
  assert.equal(podePedirAmizade({ ...base, teacher: true }), false);
  assert.equal(podePedirAmizade({ ...base, signedIn: false }), false);
  assert.equal(podePedirAmizade({ ...base, mySchoolId: null, schoolIds: [] }), true, 'sem dados não se esconde');
  assert.match(restrictedNotice('school'), /mesma escola/);
  assert.match(restrictedNotice('private'), /escolheu não mostrar/);
  assert.match(restrictedNotice('school', true), /Bloqueaste/);
  assert.doesNotMatch(restrictedNotice('school', true), /mesma escola/);
});
