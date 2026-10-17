import assert from 'node:assert/strict';
import { test } from 'node:test';
import { effectiveFault, normalizeFault } from './fault.ts';

test('só 500 e timeout são falhas', () => {
  assert.equal(normalizeFault('500'), '500');
  assert.equal(normalizeFault(' Timeout '), 'timeout');
  assert.equal(normalizeFault('404'), '');
  assert.equal(normalizeFault(undefined), '');
});

test('o que se liga em runtime ganha ao ambiente, inclusive desligado', () => {
  assert.equal(effectiveFault(undefined, '500'), '500');
  assert.equal(effectiveFault('', '500'), '');
  assert.equal(effectiveFault('timeout', ''), 'timeout');
});
