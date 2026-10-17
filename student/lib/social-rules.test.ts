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
  assert.equal(profileTabOf('Medalhas'), 'Medalhas');
  assert.equal(profileTabOf(['Histórico', 'x']), 'Histórico');
  assert.equal(profileTabOf('hack'), 'Publicações');
  assert.equal(profileTabOf(undefined), 'Publicações');
});
