// node --test lib/mock/accept-practice.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { acceptAnswer, type MockPostComment } from './feed-comments.ts';
import { practiceQuestionIds } from './practice.ts';

/** Resposta aceite e treino montado (kixi#729): o mock tem de obedecer às regras do backend. */

const AUTOR = 3;
const post = { id: 9, authorAccountId: AUTOR };
const comment = (id: number, extra: Partial<MockPostComment> = {}): MockPostComment => ({
  id, postId: 9, authorAccountId: 4, content: 'resposta', isHidden: false, createdAt: '2026-11-05T10:00:00', updatedAt: '2026-11-05T10:00:00', ...extra,
});

test('só o autor da pergunta aceita uma resposta', () => {
  const rows = [comment(1)];
  assert.deepEqual(acceptAnswer(rows, post, 4, 1), { ok: false, status: 403, message: 'Only the author can accept an answer' });
  assert.equal(rows[0].isAccepted, undefined);
});

test('aceitar outra resposta retira a anterior: no máximo uma por pergunta', () => {
  const rows = [comment(1), comment(2)];
  acceptAnswer(rows, post, AUTOR, 1);
  acceptAnswer(rows, post, AUTOR, 2);
  assert.deepEqual(rows.map((c) => !!c.isAccepted), [false, true]);
});

test('voltar a aceitar a mesma resposta retira-a', () => {
  const rows = [comment(1)];
  acceptAnswer(rows, post, AUTOR, 1);
  const again = acceptAnswer(rows, post, AUTOR, 1) as MockPostComment;
  assert.equal(again.isAccepted, false);
});

test('um comentário de outra publicação é 404', () => {
  const rows = [comment(1, { postId: 77 })];
  assert.deepEqual(acceptAnswer(rows, post, AUTOR, 1), { ok: false, status: 404, message: 'Comment not found' });
});

test('o treino leva N folhas e deixa os cabeçalhos de grupo de fora', () => {
  const paper = [101, 102, 103, 104, 105, 106];
  const grupos = new Set([102]);
  assert.deepEqual(practiceQuestionIds(paper, grupos, 3), [101, 103, 104]);
});

test('N que chega para a prova toda não restringe nada', () => {
  const paper = [1, 2, 3];
  assert.equal(practiceQuestionIds(paper, new Set(), 3), undefined);
  assert.equal(practiceQuestionIds(paper, new Set(), 50), undefined);
});
