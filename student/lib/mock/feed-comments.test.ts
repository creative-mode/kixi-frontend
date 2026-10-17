// node --test lib/mock/feed-comments.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { conversation, type MockPostComment } from './feed-comments.ts';

/** A conversa de uma publicação (#179): o painel mostra-a, e o mock tem de saber
 *  devolvê-la na ordem e com os mesmos campos que o backend devolvem. */

const NUNO = 'Nuno D.';
const names = (id: number) => (id === 4 ? NUNO : id === 3 ? 'Abner E.' : null);

const comments = (): MockPostComment[] => [
  { id: 2, postId: 1, authorAccountId: 3, content: 'Segundo', isHidden: false, createdAt: '2026-10-16T10:05:00', updatedAt: '2026-10-16T10:05:00' },
  { id: 1, postId: 1, authorAccountId: 4, content: 'Primeiro', isHidden: false, createdAt: '2026-10-16T10:00:00', updatedAt: '2026-10-16T10:00:00' },
  { id: 3, postId: 1, authorAccountId: 4, content: 'Oculto', isHidden: true, createdAt: '2026-10-16T10:06:00', updatedAt: '2026-10-16T10:06:00' },
];

test('a conversa vem do mais antigo para o mais novo, com nome mascarado e "mine"', () => {
  const rows = conversation(comments(), true, 3, names);
  assert.ok(Array.isArray(rows));
  assert.deepEqual(rows.map((r) => r.content), ['Primeiro', 'Segundo']);
  assert.equal(rows[0].mine, false);
  assert.equal(rows[0].displayName, NUNO);
  assert.equal(rows[1].mine, true);
});

test('um comentário escondido não aparece, e uma conversa sem nada é vazia', () => {
  const rows = conversation(comments(), true, 4, names);
  assert.ok(Array.isArray(rows));
  assert.ok(rows.every((r) => r.content !== 'Oculto'));
  assert.deepEqual(conversation([], true, 3, names), []);
});

test('paginar a conversa continua, não recomeça', () => {
  const rows = conversation(comments(), true, 3, names, 2, 1);
  assert.ok(Array.isArray(rows));
  assert.deepEqual(rows.map((r) => r.content), ['Segundo']);
});

test('uma conta sem nome no perfil fica sem displayName, e não com um inventado', () => {
  const rows = conversation([{ ...comments()[0], authorAccountId: 99 }], true, 3, names);
  assert.ok(Array.isArray(rows));
  assert.equal(rows[0].displayName, null);
});

test('um post fora do âmbito é 404, não uma lista vazia', () => {
  const rows = conversation(comments(), false, 3, names);
  assert.ok(!Array.isArray(rows));
  assert.equal(rows.status, 404);
});

test('uma página que o servidor não serviria é recusada antes do âmbito', () => {
  const rows = conversation(comments(), false, 3, names, 0, 20);
  assert.ok(!Array.isArray(rows));
  assert.equal(rows.status, 400);
  assert.equal((conversation(comments(), true, 3, names, 1, 5000) as { status: number }).status, 400);
});
