import assert from 'node:assert/strict';
import test from 'node:test';
import { isMockEnabled } from './dev-secret.ts';

test('the student mock requires KIXI_MOCK=true explicitly', () => {
  assert.equal(isMockEnabled({ KIXI_MOCK: 'true' }), true);
  assert.equal(isMockEnabled({ KIXI_MOCK: 'false' }), false);
  assert.equal(isMockEnabled({}), false);
});
