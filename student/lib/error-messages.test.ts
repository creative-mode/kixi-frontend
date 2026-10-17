import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isRetryable, messageForStatus } from './error-messages.ts';

test('devolve português para cada estado que o backend usa', () => {
  for (const status of [400, 401, 403, 404, 408, 409, 413, 422, 429, 500, 502, 503, 418]) {
    const text = messageForStatus(status);
    assert.ok(text.length > 10, `sem texto para ${status}`);
    assert.doesNotMatch(text, /\b(not found|cannot|statement|error)\b/i);
  }
});

test('não confunde sessão expirada com falta de permissão', () => {
  assert.match(messageForStatus(401), /sessão/);
  assert.match(messageForStatus(403), /permissão/);
});

test('só deixa repetir o que pode passar sozinho', () => {
  for (const s of [0, 408, 429, 500, 503]) assert.equal(isRetryable(s), true, String(s));
  for (const s of [400, 401, 403, 404, 409, 422]) assert.equal(isRetryable(s), false, String(s));
});
