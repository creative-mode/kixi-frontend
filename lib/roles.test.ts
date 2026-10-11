// Testes das rotas do professor no gestor:  node --test lib/roles.test.ts
//
// O professor tem de chegar ao import e à revisão do enunciado (a #22 é sobre ele),
// e não pode chegar à lixeira nem à gestão.
import test from 'node:test';
import assert from 'node:assert/strict';
import { teacherMayOpen } from './roles.ts';

test('o professor abre o exam-builder, a lista, o import e a revisão de um enunciado', () => {
  for (const p of ['/exam-builder', '/exam-builder/x', '/statements', '/statements/import', '/statements/42']) {
    assert.equal(teacherMayOpen(p), true, p);
  }
});

test('a lixeira, a gestão e o resto ficam de fora', () => {
  for (const p of ['/', '/statements/trash', '/statements/42/x', '/statements-x', '/accounts', '/institutions', '/exam-builderx']) {
    assert.equal(teacherMayOpen(p), false, p);
  }
});
