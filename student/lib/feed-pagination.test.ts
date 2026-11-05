import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FEED_PAGE_SIZE, isLastFeedPage, mergeFeedPages } from './feed-pagination.ts';

test('junta as páginas na ordem e sem repetir a publicação que veio nas duas', () => {
  const first = [{ id: 9 }, { id: 8 }, { id: 7 }];
  const second = [{ id: 7 }, { id: 6 }];
  assert.deepEqual(mergeFeedPages(first, second).map((p) => p.id), [9, 8, 7, 6]);
});

test('não altera as páginas recebidas', () => {
  const first = [{ id: 2 }];
  const second = [{ id: 1 }];
  mergeFeedPages(first, second);
  assert.deepEqual(first, [{ id: 2 }]);
  assert.deepEqual(second, [{ id: 1 }]);
});

test('uma página vazia não inventa nada', () => {
  assert.deepEqual(mergeFeedPages([], []), []);
});

test('só a página com menos linhas do que o limite é a última', () => {
  assert.equal(isLastFeedPage(FEED_PAGE_SIZE - 1), true);
  assert.equal(isLastFeedPage(0), true);
  assert.equal(isLastFeedPage(FEED_PAGE_SIZE), false);
  assert.equal(isLastFeedPage(FEED_PAGE_SIZE + 1), false);
  assert.equal(isLastFeedPage(4, 5), true);
});
