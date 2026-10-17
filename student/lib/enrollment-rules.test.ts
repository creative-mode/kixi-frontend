import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseTurma, turmaValue } from './enrollment-rules.ts';

test('o valor da turma leva o ano letivo e lê-se de volta', () => {
  assert.equal(turmaValue(4, 2), '4:2');
  assert.deepEqual(parseTurma('4:2'), { classId: 4, schoolYearId: 2 });
});

test('sem ano letivo ou sem turma, não há matrícula', () => {
  assert.equal(parseTurma(turmaValue(4, null)), null);
  assert.equal(parseTurma(''), null);
  assert.equal(parseTurma(':2'), null);
  assert.equal(parseTurma(undefined), null);
  assert.equal(parseTurma('x:y'), null);
});
