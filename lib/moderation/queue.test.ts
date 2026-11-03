// Os separadores da moderação (#535): node --test lib/moderation/queue.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { moderationCounts, MODERATION_FILTERS, DEFAULT_MODERATION_FILTER } from './queue.ts';

test('conta o que está por decidir e o que já foi decidido, seja qual for a decisão', () => {
  const reports = [{ status: 'OPEN' }, { status: 'HIDDEN' }, { status: 'OPEN' }, { status: 'IGNORED' }, { status: 'SUSPENDED' }] as const;
  assert.deepEqual(moderationCounts(reports), { 'por-decidir': 2, decididas: 3 });
});

test('sem denúncias tudo é zero', () => {
  assert.deepEqual(moderationCounts([]), { 'por-decidir': 0, decididas: 0 });
});

test('abre no que há para decidir', () => {
  assert.equal(DEFAULT_MODERATION_FILTER, 'por-decidir');
  assert.deepEqual(MODERATION_FILTERS.map((f) => f.label), ['Por decidir', 'Decididas']);
});
