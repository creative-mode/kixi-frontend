// Testes da paginação do catálogo:  node --test student/lib/mock/catalog-page.test.ts
//
// O bug que estes testes apanham: a página lia só a primeira fatia do backend e
// paginava de memória, por isso um aluno com 300 provas nunca chegava às outras
// 280. A regra aqui espelha o StatementCatalogController (ids, página 0-based).
import test from 'node:test';
import assert from 'node:assert/strict';
import { catalogPage, type CatalogRow } from './catalog-page.ts';

const rows: CatalogRow[] = [
  { id: 1, title: 'Redes de Computadores', examType: 'Teste', subjectId: 1, schoolYearId: 1, institutionId: 1, classId: 1 },
  { id: 2, title: 'Sistemas Operativos', examType: 'Prova', subjectId: 2, schoolYearId: 1, institutionId: 1, classId: 2 },
  { id: 3, title: 'Matemática Discreta', examType: 'Exame', subjectId: 3, schoolYearId: 1, institutionId: 2, classId: 6 },
];

test('devolve PageResponse com tudo quando não há filtros', () => {
  const page = catalogPage(rows, {});
  assert.equal(page.content.length, 3);
  assert.equal(page.totalElements, 3);
  assert.equal(page.totalPages, 1);
  assert.equal(page.page, 0);
});

test('filtra por ids, não por nomes', () => {
  const page = catalogPage(rows, { subjectId: 1, institutionId: 1 });
  assert.deepEqual(page.content.map((s) => s.id), [1]);
});

test('o tipo de prova compara sem olhar a maiúsculas', () => {
  const page = catalogPage(rows, { examType: 'exame' });
  assert.deepEqual(page.content.map((s) => s.id), [3]);
});

test('a página é 0-based e corta como o PageResponse.of', () => {
  const page = catalogPage(rows, { page: 1, size: 2 });
  assert.deepEqual(page.content.map((s) => s.id), [3]);
  assert.equal(page.totalElements, 3);
  assert.equal(page.totalPages, 2);
});

test('o texto livre procura em título e tipo', () => {
  const page = catalogPage(rows, { q: 'sistemas' });
  assert.deepEqual(page.content.map((s) => s.id), [2]);
});
