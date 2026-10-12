import assert from 'node:assert/strict';
import { test } from 'node:test';
import { levelProgress } from './gamification-rules.ts';

test('a meio de um nível de 100 XP, a barra fica a meio', () => {
  assert.equal(levelProgress(150, 2), 50);
});

test('no início exato de um nível, a barra começa vazia', () => {
  assert.equal(levelProgress(100, 2), 0);
});

test('nunca sai de 0-100, mesmo com XP de outro nível', () => {
  assert.equal(levelProgress(50, 2), 0);
  assert.equal(levelProgress(999, 1), 100);
});
