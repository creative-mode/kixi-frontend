import test from 'node:test';
import assert from 'node:assert/strict';

import { byUrgency, denunciasLabel, isPostId, postVisibilityPath, preview, REPORTED_POSTS_PATH, splitByVisibility, type ReportedPost } from './posts.ts';

const post = (over: Partial<ReportedPost>): ReportedPost => ({ postId: 1, authorAccountId: 2, classId: 3, content: 'texto', isHidden: false, reportCount: 1, createdAt: '2026-11-01T10:00:00', ...over });

test('os caminhos são os do PostController', () => {
  assert.equal(REPORTED_POSTS_PATH, '/api/v1/feed/posts/reported');
  assert.equal(postVisibilityPath(7, true), '/api/v1/feed/posts/7/hide');
  assert.equal(postVisibilityPath(7, false), '/api/v1/feed/posts/7/unhide');
});

test('só se aceita um id inteiro e positivo', () => {
  assert.ok(isPostId(1));
  for (const bad of [0, -1, 1.5, NaN, '1', null, undefined]) assert.ok(!isPostId(bad), String(bad));
});

test('as mais denunciadas vêm primeiro, e a igualdade desfaz-se pela mais recente', () => {
  const a = post({ postId: 1, reportCount: 1, createdAt: '2026-11-01T10:00:00' });
  const b = post({ postId: 2, reportCount: 3, createdAt: '2026-10-01T10:00:00' });
  const c = post({ postId: 3, reportCount: 1, createdAt: '2026-11-02T10:00:00' });
  assert.deepEqual(byUrgency([a, b, c]).map((p) => p.postId), [2, 3, 1]);
});

test('as ocultas separam-se das que ainda estão à vista', () => {
  const { visiveis, ocultas } = splitByVisibility([post({ postId: 1 }), post({ postId: 2, isHidden: true })]);
  assert.deepEqual(visiveis.map((p) => p.postId), [1]);
  assert.deepEqual(ocultas.map((p) => p.postId), [2]);
});

test('o resumo corta nas palavras e junta os espaços', () => {
  assert.equal(preview('  uma   frase\ncurta '), 'uma frase curta');
  const long = preview('palavra '.repeat(100), 40);
  assert.ok(long.length <= 40 && long.endsWith('…'));
});

test('o rótulo das denúncias concorda em número', () => {
  assert.equal(denunciasLabel(1), '1 denúncia');
  assert.equal(denunciasLabel(4), '4 denúncias');
});
