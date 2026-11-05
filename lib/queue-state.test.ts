// Filtro e página das filas no endereço (#535): node --test lib/queue-state.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { nextTabIndex, paginate, parseChoice, parsePage, queryWith, stepIndex } from './queue-state.ts';

const FILTROS = ['todos', 'rever', 'ocr'] as const;

test('um filtro conhecido passa, o resto volta ao padrão', () => {
  assert.equal(parseChoice('rever', FILTROS, 'todos'), 'rever');
  assert.equal(parseChoice('inventado', FILTROS, 'todos'), 'todos');
  assert.equal(parseChoice(undefined, FILTROS, 'todos'), 'todos');
  assert.equal(parseChoice(null, FILTROS, 'todos'), 'todos');
  assert.equal(parseChoice('', FILTROS, 'todos'), 'todos');
});

test('um parâmetro repetido conta pelo primeiro valor', () => {
  assert.equal(parseChoice(['ocr', 'rever'], FILTROS, 'todos'), 'ocr');
  assert.equal(parseChoice(['nada', 'ocr'], FILTROS, 'todos'), 'todos');
});

test('o filtro não aceita nomes herdados do objeto', () => {
  assert.equal(parseChoice('constructor', FILTROS, 'todos'), 'todos');
  assert.equal(parseChoice('__proto__', FILTROS, 'todos'), 'todos');
});

test('a página é um inteiro a partir de 1', () => {
  assert.equal(parsePage('3'), 3);
  assert.equal(parsePage(['2', '9']), 2);
  for (const lixo of ['0', '-1', '1.5', 'abc', '', undefined, null, 'NaN', 'Infinity']) {
    assert.equal(parsePage(lixo), 1, `valor ${String(lixo)}`);
  }
});

test('a paginação corta a lista e diz o intervalo mostrado', () => {
  const todos = Array.from({ length: 25 }, (_, i) => i + 1);
  const p2 = paginate(todos, 2, 10);
  assert.deepEqual(p2.items, [11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
  assert.deepEqual({ page: p2.page, pages: p2.pages, total: p2.total, first: p2.first, last: p2.last }, { page: 2, pages: 3, total: 25, first: 11, last: 20 });
  assert.deepEqual(paginate(todos, 3, 10).items, [21, 22, 23, 24, 25]);
  assert.equal(paginate(todos, 3, 10).last, 25);
});

test('pedir uma página que já não existe mostra a última, não uma lista vazia', () => {
  const pagina = paginate([1, 2, 3], 9, 2);
  assert.equal(pagina.page, 2);
  assert.deepEqual(pagina.items, [3]);
  assert.equal(paginate([1, 2, 3], 0, 2).page, 1);
});

test('uma lista vazia tem uma página e o intervalo a zeros', () => {
  const vazia = paginate([], 1, 10);
  assert.deepEqual({ items: vazia.items, page: vazia.page, pages: vazia.pages, first: vazia.first, last: vazia.last }, { items: [], page: 1, pages: 1, first: 0, last: 0 });
});

test('a query string aplica o patch sem mexer no resto', () => {
  assert.equal(queryWith('', { filtro: 'rever' }), '?filtro=rever');
  assert.equal(queryWith('?a=1&filtro=todos', { filtro: 'ocr' }), '?a=1&filtro=ocr');
  assert.equal(queryWith('?filtro=ocr&pagina=3', { pagina: null }), '?filtro=ocr');
  assert.equal(queryWith('?filtro=ocr', { filtro: null }), '');
  assert.equal(queryWith('?a=1', {}), '?a=1');
});

test('os valores são codificados', () => {
  assert.equal(queryWith('', { filtro: 'a b&c' }), '?filtro=a+b%26c');
});

test('as setas andam pelos separadores e dão a volta nas pontas', () => {
  assert.equal(nextTabIndex('ArrowRight', 0, 3), 1);
  assert.equal(nextTabIndex('ArrowRight', 2, 3), 0);
  assert.equal(nextTabIndex('ArrowLeft', 1, 3), 0);
  assert.equal(nextTabIndex('ArrowLeft', 0, 3), 2);
});

test('Home e End vão às pontas, e outras teclas não mexem', () => {
  assert.equal(nextTabIndex('Home', 2, 4), 0);
  assert.equal(nextTabIndex('End', 0, 4), 3);
  for (const key of ['Enter', ' ', 'ArrowDown', 'ArrowUp', 'a', 'Tab']) assert.equal(nextTabIndex(key, 1, 3), null);
});

test('sem separadores não há para onde ir', () => {
  assert.equal(nextTabIndex('ArrowRight', 0, 0), null);
});

test('J e K andam pela fila e pararam nas pontas, sem dar a volta', () => {
  assert.equal(stepIndex(1, 4, 1), 2);
  assert.equal(stepIndex(2, 4, -1), 1);
  assert.equal(stepIndex(3, 4, 1), 3);
  assert.equal(stepIndex(0, 4, -1), 0);
});

test('sem foco na fila, J vai ao primeiro e K ao último', () => {
  assert.equal(stepIndex(-1, 4, 1), 0);
  assert.equal(stepIndex(-1, 4, -1), 3);
});

test('uma fila vazia não leva a lado nenhum', () => {
  assert.equal(stepIndex(-1, 0, 1), null);
  assert.equal(stepIndex(0, 0, -1), null);
});
