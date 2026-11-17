import { test } from 'node:test';
import assert from 'node:assert/strict';
import { syncRankingVisibility, type PreferenceResult } from './ranking-visibility-sync.ts';
import { VISIBILITY_SCOPES, type VisibilityPreferences } from './ranking-rules.ts';

const ok = (data: VisibilityPreferences): PreferenceResult => ({ ok: true, data });
const all = (value: 'visible' | 'anonymous' | 'hidden'): VisibilityPreferences =>
  Object.fromEntries(VISIBILITY_SCOPES.map((scope) => [scope, value])) as VisibilityPreferences;

test('as três escritas concordam quando o servidor aceita todas', async () => {
  const written: string[] = [];
  const result = await syncRankingVisibility(
    async (scope, value) => {
      written.push(`${scope}:${value}`);
      return ok(all(value));
    },
    async () => ok(all('visible')),
    'anonymous',
  );
  assert.deepEqual(written, ['class:anonymous', 'school:anonymous', 'friends:anonymous']);
  assert.deepEqual(result, { ok: true, preferences: all('anonymous') });
});

test('falha parcial: a releitura repõe o estado real em vez do valor otimista', async () => {
  const real: VisibilityPreferences = { class: 'visible', school: 'visible', friends: 'anonymous' };
  let reads = 0;
  const result = await syncRankingVisibility(
    async (scope, value) => scope === 'friends'
      ? { ok: false, message: 'Não foi possível guardar em Amigos' }
      : ok(all(value)),
    async () => { reads++; return ok(real); },
    'visible',
  );
  assert.equal(reads, 1, 'a falha parcial tem de reler o servidor');
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.deepEqual(result.preferences, real);
    assert.match(result.message, /Não foi possível guardar em Amigos/);
    assert.match(result.message, /estado que o servidor guardou/);
  }
});

test('se a releitura também falha, o ecrã é avisado de que não sabe o estado', async () => {
  const result = await syncRankingVisibility(
    async (scope, value) => scope === 'school'
      ? { ok: false, message: 'Falha na Escola' }
      : ok(all(value)),
    async () => ({ ok: false, message: 'Servidor indisponível' }),
    'anonymous',
  );
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.preferences, null);
    assert.match(result.message, /Falha na Escola/);
    assert.match(result.message, /Não foi possível confirmar/);
  }
});
