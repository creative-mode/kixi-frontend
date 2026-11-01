import test from 'node:test';
import assert from 'node:assert/strict';
import { formatLuandaDateTime, fromLuandaDateTimeLocal, toLuandaDateTimeLocal } from './format.ts';

test('formata instantes no fuso de Luanda através da meia-noite UTC', () => {
  assert.match(formatLuandaDateTime('2026-10-31T23:30:00Z'), /00:30/);
});

test('datetime-local preserva a hora de parede da API', () => {
  const instant = '2026-10-31T23:30:00.000Z';
  assert.equal(toLuandaDateTimeLocal(instant), '2026-11-01T00:30');
  assert.equal(toLuandaDateTimeLocal('2026-11-01T09:00:00'), '2026-11-01T09:00');
  assert.equal(fromLuandaDateTimeLocal('2026-11-01T09:00'), '2026-11-01T09:00:00');
  assert.match(formatLuandaDateTime('2026-10-14T09:12:00'), /09:12/);
});

test('datas e horas inválidas não viram datas locais inventadas', () => {
  assert.equal(formatLuandaDateTime('invalid'), '—');
  assert.equal(toLuandaDateTimeLocal('invalid'), '');
  assert.equal(fromLuandaDateTimeLocal('2026-02-30T09:00'), null);
});
