// A navegação autenticada não aparece nas páginas públicas:  node --test lib/public-pages.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { isManagerPublicPage } from './public-pages.ts';

test('login, 403 e recuperar são públicas (sem menu do gestor); a de recuperar mostrava o menu todo a um anónimo', () => {
  for (const p of ['/login', '/403', '/recuperar', '/recuperar/']) assert.equal(isManagerPublicPage(p), true, p);
});

test('as páginas autenticadas continuam com menu', () => {
  for (const p of ['/', '/pautas', '/exam-rooms/3', '/recuperar-x', '/login/outra', null, undefined, '']) assert.equal(isManagerPublicPage(p), false, String(p));
});
