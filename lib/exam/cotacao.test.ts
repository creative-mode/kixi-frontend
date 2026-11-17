import assert from 'node:assert/strict';
import test from 'node:test';

import { formatCotação, parseCotação } from './cotacao.ts';

test('a vírgula e o ponto valem o mesmo', () => {
  assert.deepEqual(parseCotação('1,5'), { ok: true, value: 1.5 });
  assert.deepEqual(parseCotação('1.5'), { ok: true, value: 1.5 });
  assert.deepEqual(parseCotação(' 3, '), { ok: true, value: 3 });
  assert.deepEqual(parseCotação('20'), { ok: true, value: 20 });
});

test('vazio é «ainda não»; inválido preserva o texto e não escreve no rascunho', () => {
  assert.deepEqual(parseCotação(''), { ok: true, value: '' });
  assert.deepEqual(parseCotação('   '), { ok: true, value: '' });
  assert.deepEqual(parseCotação('abc'), { ok: false });
  assert.deepEqual(parseCotação('-1'), { ok: false });
  assert.deepEqual(parseCotação('1,5,3'), { ok: false });
});

test('o que o professor escreve mostra-se de volta com vírgula', () => {
  assert.equal(formatCotação(1.5), '1,5');
  assert.equal(formatCotação(''), '');
  assert.equal(formatCotação(20), '20');
});

test('o ida e volta não perde a vírgula', () => {
  const round = (v: number | ''): number | '' => {
    const parsed = parseCotação(formatCotação(v));
    return parsed.ok ? parsed.value : '';
  };
  assert.equal(round(2.5), 2.5);
  assert.equal(formatCotação(round(2.5)), '2,5');
  assert.equal(round(''), '');
});
