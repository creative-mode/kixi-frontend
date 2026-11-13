import test from 'node:test';
import assert from 'node:assert/strict';

import { MODERATION_UNAVAILABLE, moderationAvailable, routeClosed } from './availability.ts';
import { visibleLinks } from '../nav-rules.ts';

test('a moderação só existe com a flag ou no modo de demonstração (#749)', () => {
  assert.equal(moderationAvailable({}), false);
  assert.equal(moderationAvailable({ MODERATION_ENABLED: 'false' }), false);
  assert.equal(moderationAvailable({ MODERATION_ENABLED: 'true' }), true);
  assert.equal(moderationAvailable({ KIXI_MOCK: 'true' }), true);
});

test('um 403, 404, 405 ou 501 de uma rota só de ADMIN é rota fechada, não falta de papel', () => {
  for (const status of [403, 404, 405, 501]) assert.ok(routeClosed(status), `${status}`);
  for (const status of [400, 401, 409, 500]) assert.ok(!routeClosed(status), `${status}`);
  assert.match(MODERATION_UNAVAILABLE, /não é falta de permissão/i);
});

test('sem a moderação, o menu não mostra Moderação nem Auditoria a ninguém', () => {
  const links = [{ href: '/' }, { href: '/moderacao' }, { href: '/moderacao/auditoria' }, { href: '/manager/verification' }];
  assert.deepEqual(visibleLinks(links, { moderation: false }).map((l) => l.href), ['/', '/manager/verification']);
  assert.equal(visibleLinks(links, { moderation: true }).length, 4);
});
