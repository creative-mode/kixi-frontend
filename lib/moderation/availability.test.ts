import test from 'node:test';
import assert from 'node:assert/strict';

import { MODERATION_UNAVAILABLE, moderationAvailable, moderationRefusal, routeClosed } from './availability.ts';
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

test('uma recusa com motivo mostra o motivo; só a sem corpo diz que a moderação não está ativa', () => {
  // O denyAll do backend sem a moderação: 403 sem corpo.
  assert.equal(moderationRefusal(403, ''), MODERATION_UNAVAILABLE);
  assert.equal(moderationRefusal(404, ''), MODERATION_UNAVAILABLE);
  // Com o backend novo: a denúncia que já não existe, e o papel retirado, dizem o que são.
  assert.equal(moderationRefusal(404, JSON.stringify({ status: 404, detail: 'Denúncia não encontrada.' })), 'Denúncia não encontrada.');
  assert.match(moderationRefusal(403, JSON.stringify({ title: 'Forbidden', status: 403, detail: 'Só o administrador gere a moderação.' })), /Só o administrador/);
  assert.equal(moderationRefusal(409, JSON.stringify({ detail: 'Esta denúncia já foi decidida.' })), 'Esta denúncia já foi decidida.');
  // Um corpo sem `detail` ou ilegível não conta como motivo; o 401 é sempre a sessão.
  assert.equal(moderationRefusal(403, JSON.stringify({ title: 'Forbidden' })), MODERATION_UNAVAILABLE);
  assert.equal(moderationRefusal(403, 'não é json'), MODERATION_UNAVAILABLE);
  assert.match(moderationRefusal(401, JSON.stringify({ detail: 'x' })), /Sessão expirada/);
  assert.match(moderationRefusal(500, ''), /./);
});
