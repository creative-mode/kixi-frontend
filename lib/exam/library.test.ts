import assert from 'node:assert/strict';
import test from 'node:test';

import { EMPTY_FILTERS, activeFilters, distinct, filterStatements, idsUsed } from './library.ts';

const ROWS = [
  { id: 1, title: 'Exame de Matemática', examType: 'Exame', variant: 'A', institutionId: 1, subjectId: 1, schoolYearId: 2, source: 'OCR', visible: true, needsReview: false },
  { id: 2, title: 'Prova de Física', examType: 'Prova', institutionId: 2, subjectId: 3, schoolYearId: 2, source: 'MANUAL', visible: false, needsReview: false },
  { id: 3, title: 'Teste de Organização e Gestão', examType: 'Teste', institutionId: 1, subjectId: 7, schoolYearId: 1, source: 'OCR', visible: true, needsReview: true },
];
const ids = (rows: { id?: unknown }[]) => rows.map((r) => r.id);
const f = (over: Partial<typeof EMPTY_FILTERS>) => ({ ...EMPTY_FILTERS, ...over });

test('sem filtros passam todos os enunciados, de todas as escolas', () => {
  assert.deepEqual(ids(filterStatements(ROWS, EMPTY_FILTERS)), [1, 2, 3]);
});

test('a pesquisa ignora acentos e maiúsculas e exige todas as palavras', () => {
  assert.deepEqual(ids(filterStatements(ROWS, f({ q: 'matematica' }))), [1]);
  assert.deepEqual(ids(filterStatements(ROWS, f({ q: 'ORGANIZAÇÃO gestao' }))), [3]);
  assert.deepEqual(ids(filterStatements(ROWS, f({ q: 'exame fisica' }))), []);
});

test('a escola, a disciplina, o ano e o tipo filtram por igualdade', () => {
  assert.deepEqual(ids(filterStatements(ROWS, f({ institutionId: '1' }))), [1, 3]);
  assert.deepEqual(ids(filterStatements(ROWS, f({ subjectId: '3' }))), [2]);
  assert.deepEqual(ids(filterStatements(ROWS, f({ schoolYearId: '2' }))), [1, 2]);
  assert.deepEqual(ids(filterStatements(ROWS, f({ examType: 'teste' }))), [3]);
});

test('o estado e a origem separam publicados, ocultos, a rever e o que veio do OCR', () => {
  assert.deepEqual(ids(filterStatements(ROWS, f({ state: 'published' }))), [1, 3]);
  assert.deepEqual(ids(filterStatements(ROWS, f({ state: 'hidden' }))), [2]);
  assert.deepEqual(ids(filterStatements(ROWS, f({ state: 'review' }))), [3]);
  assert.deepEqual(ids(filterStatements(ROWS, f({ source: 'ocr' }))), [1, 3]);
});

test('os filtros combinam-se e contam-se', () => {
  const both = f({ institutionId: '1', state: 'published', source: 'OCR' });
  assert.deepEqual(ids(filterStatements(ROWS, both)), [1, 3]);
  assert.equal(activeFilters(both), 3);
  assert.equal(activeFilters(EMPTY_FILTERS), 0);
});

test('os filtros oferecem só o que existe', () => {
  assert.deepEqual(distinct(ROWS, 'examType'), ['Exame', 'Prova', 'Teste']);
  assert.deepEqual([...idsUsed(ROWS, 'institutionId')].sort(), ['1', '2']);
});
