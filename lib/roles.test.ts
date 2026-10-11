// Testes das rotas do professor no gestor:  node --test lib/roles.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { teacherRoute } from './roles.ts';

test('o professor abre o seu início, o exam-builder, as listas e o fluxo do enunciado', () => {
  for (const p of [
    '/professor',
    '/desempenho',
    '/exam-builder',
    '/exam-builder/x',
    '/statements',
    '/statements/import',
    '/statements/42',
    '/simulations',
    '/simulation-answers',
    '/classes',
  ]) {
    assert.equal(teacherRoute(p), 'allow', p);
  }
});

test('a gestão dá 403, para ele saber porque não entra', () => {
  for (const p of ['/accounts', '/accounts/1/edit', '/roles', '/institutions', '/teachers', '/teaching-assignments', '/school-year/new']) {
    assert.equal(teacherRoute(p), 'forbidden', p);
  }
});

test('lixeiras, formulários e o resto voltam ao início dele', () => {
  for (const p of [
    '/',
    '/statements/trash',
    '/statements/42/x',
    '/statements-x',
    '/simulations/trash',
    '/classes/new',
    '/classes/3/edit',
    '/simulation-answers/9/edit',
    '/exam-builderx',
    '/professorx',
    '/desempenho/1',
  ]) {
    assert.equal(teacherRoute(p), 'home', p);
  }
});
