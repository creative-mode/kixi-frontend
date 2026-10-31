import assert from 'node:assert/strict';
import test from 'node:test';
import { deriveFrame, progressFromRect } from './presentation-timeline.ts';

test('no topo o herói está aceso e o demo visível', () => {
  const f = deriveFrame(0);
  assert.equal(f.hero, 1);
  assert.equal(f.showDemo, true);
  assert.equal(f.showGameboy, true);
  assert.equal(f.reveal, 0);
});

test('progressFromRect no início é 0 e no fim é 1', () => {
  assert.equal(progressFromRect(0, 2000, 800), 0);
  assert.equal(progressFromRect(-1200, 2000, 800), 1);
});

test('a meio do scroll o cartucho já revela e o demo já saiu', () => {
  const f = deriveFrame(0.5);
  assert.equal(f.showDemo, false);
  assert.ok(f.reveal > 0.9);
  assert.equal(f.showGameboy, false);
});
