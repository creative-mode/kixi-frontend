// Testes das rotas do professor no gestor:  node --test lib/roles.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { teacherRoute } from './roles.ts';

test('o professor abre o seu início, o exam-builder, as listas e o fluxo do enunciado', () => {
  for (const p of [
    '/professor',
    '/professor/tutor',
    '/exam-rooms',
    '/exam-rooms/new',
    '/exam-rooms/12',
    '/tarefas',
    '/pautas',
    '/tarefas/2251799813726180',
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
  for (const p of ['/accounts', '/accounts/1/edit', '/roles', '/institutions', '/teachers', '/teaching-assignments', '/school-year/new', '/donations', '/donations/3', '/donations/3/files/1', '/verification']) {
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
    '/assign',
    '/assignment-settings',
    '/professorx',
    '/professor/tutor/1',
    '/exam-rooms/12/edit',
    '/desempenho/1',
  ]) {
    assert.equal(teacherRoute(p), 'home', p);
  }
});

test('isStructureEntity: a estrutura académica é só do ADMIN', async () => {
  const { isStructureEntity } = await import('./roles.ts');
  for (const k of ['classes', 'courses', 'subjects', 'school-years', 'terms', 'institutions']) assert.equal(isStructureEntity(k), true, k);
  for (const k of ['statements', 'simulations', 'accounts']) assert.equal(isStructureEntity(k), false, k);
});

test('o professor não abre uma tarefa que não é um número (a chave do Camunda)', () => {
  for (const p of ['/tarefas/abc', '/tarefas/12/outra', '/tarefas/']) assert.notEqual(teacherRoute(p), 'allow', p);
  for (const p of ['/pautas/1', '/pautas/PT-1/editar']) assert.notEqual(teacherRoute(p), 'allow', p);
});
