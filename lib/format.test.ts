import test from 'node:test';
import assert from 'node:assert/strict';
import { formatLuandaDateTime, fromLuandaDateTimeLocal, toLuandaDateTimeLocal } from './format.ts';

test('formata instantes no fuso de Luanda através da meia-noite UTC', () => {
  assert.match(formatLuandaDateTime('2026-10-31T23:30:00Z'), /00:30/);
});

test('datetime-local usa a hora de parede de Luanda e volta ao mesmo instante', () => {
  const instant = '2026-10-31T23:30:00.000Z';
  assert.equal(toLuandaDateTimeLocal(instant), '2026-11-01T00:30');
  assert.equal(fromLuandaDateTimeLocal('2026-11-01T00:30'), instant);
});

test('datas e horas inválidas não viram datas locais inventadas', () => {
  assert.equal(formatLuandaDateTime('invalid'), '—');
  assert.equal(toLuandaDateTimeLocal('invalid'), '');
  assert.equal(fromLuandaDateTimeLocal('2026-02-30T09:00'), null);
});
