// Ordenação e pesquisa das listagens CRUD pelo texto visível (#526): node --test lib/crud/list-state.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { cellText, matchesQuery, parseSortLabel, rowText, sortRows } from './list-state.ts';

test('cellText extrai o texto por dentro do JSX', () => {
  assert.equal(cellText('Olá'), 'Olá');
  assert.equal(cellText(42), '42');
  assert.equal(cellText(null), '');
  assert.equal(cellText(false), '');
  assert.equal(cellText(createElement('strong', null, 'Kixi')), 'Kixi');
  assert.equal(
    cellText(createElement('span', null, 'a', createElement('b', null, 'b'), ['c', 'd'])),
    'a b c d',
  );
});

test('rowText só junta as colunas visíveis', () => {
  const row = { name: 'Ana', photoUrl: 'https://cdn/img.png', internalId: 999 };
  const columns = [{ value: (r: Record<string, unknown>) => r.name as string }];
  assert.equal(rowText(row, columns), 'Ana');
});

test('matchesQuery não casa com campos invisíveis', () => {
  const row = { name: 'Ana', photoUrl: 'https://cdn/img.png', internalId: 999 };
  const columns = [{ value: (r: Record<string, unknown>) => r.name as string }];
  assert.equal(matchesQuery(row, columns, undefined, 'ana'), true);
  assert.equal(matchesQuery(row, columns, undefined, 'cdn'), false);
  assert.equal(matchesQuery(row, columns, undefined, '999'), false);
  assert.equal(matchesQuery(row, columns, undefined, '  '), true);
});

test('sortRows ordena texto com números como gente', () => {
  const rows = [{ n: 'Turma 10' }, { n: 'Turma 2' }, { n: 'Turma 1' }];
  const key = (r: { n: string }) => r.n;
  assert.deepEqual(sortRows(rows, key, 'asc').map((r) => r.n), ['Turma 1', 'Turma 2', 'Turma 10']);
  assert.deepEqual(sortRows(rows, key, 'desc').map((r) => r.n), ['Turma 10', 'Turma 2', 'Turma 1']);
});

test('parseSortLabel só aceita rótulos das colunas', () => {
  const labels = ['Aluno', 'Prova', 'Nota'];
  assert.equal(parseSortLabel('Aluno', labels), 0);
  assert.equal(parseSortLabel('Nota', labels), 2);
  assert.equal(parseSortLabel('0', labels), null);
  assert.equal(parseSortLabel('Inexistente', labels), null);
  assert.equal(parseSortLabel('', labels), null);
  assert.equal(parseSortLabel(null, labels), null);
  assert.equal(parseSortLabel(['Prova', 'Nota'], labels), 1);
});
