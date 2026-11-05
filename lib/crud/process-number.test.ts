// O número de processo (kixi#512): node --test lib/crud/process-number.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { PROCESS_NUMBER_MAX, parseProcessNumber } from './process-number.ts';

test('apara e aceita o que se imprime numa pauta', () => {
  assert.deepEqual(parseProcessNumber('  P-2026/0042 '), { ok: true, value: 'P-2026/0042' });
  assert.deepEqual(parseProcessNumber('A 12.3_b'), { ok: true, value: 'A 12.3_b' });
  assert.deepEqual(parseProcessNumber('Nº 7'), { ok: true, value: 'Nº 7' });
  assert.deepEqual(parseProcessNumber('x'.repeat(PROCESS_NUMBER_MAX)), { ok: true, value: 'x'.repeat(PROCESS_NUMBER_MAX) });
});

test('vazio ou só espaços é «sem número», para apagar', () => {
  assert.deepEqual(parseProcessNumber(''), { ok: true, value: null });
  assert.deepEqual(parseProcessNumber('   '), { ok: true, value: null });
});

test('recusa o que passa do limite ou não se imprime', () => {
  for (const bad of ['x'.repeat(PROCESS_NUMBER_MAX + 1), '<script>', 'a;b', 'linha\nnova', '-começa', '/começa']) {
    assert.equal(parseProcessNumber(bad).ok, false, bad);
  }
  assert.match((parseProcessNumber('x'.repeat(31)) as { error: string }).error, /30 caracteres/);
});
