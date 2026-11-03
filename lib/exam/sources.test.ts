import assert from 'node:assert/strict';
import test from 'node:test';

import { sourceKind, newSourceId, sourcePageCount, pageAtSources, flattenSourcePages, moveAnnouncement } from './sources.ts';

const pdf = { name: 'prova.pdf', type: 'application/pdf' };
const imagem = { name: 'p1.jpg', type: 'image/jpeg' };
const semTipo = { name: 'outro.PDF' };

test('sourceKind distingue PDF de imagem pelo MIME ou pela extensão', () => {
  assert.equal(sourceKind(pdf), 'pdf');
  assert.equal(sourceKind(imagem), 'image');
  assert.equal(sourceKind(semTipo), 'pdf');
  const tif = { name: 'prova.tiff' };
  assert.equal(sourceKind(tif), 'image');
});

test('ids de fonte são únicos, para o foco sobreviver à reordenação', () => {
  const a = newSourceId();
  const b = newSourceId();
  assert.notEqual(a, b);
  assert.ok(a.length > 0);
});

test('sourcePageCount conta 1 por imagem e o que sabe sobre o PDF', () => {
  assert.equal(sourcePageCount(imagem, 0), 1);
  assert.equal(sourcePageCount(pdf, null), 1); // desconhecido: trata-se como 1 até se abrir
  assert.equal(sourcePageCount(pdf, 0), 1);
  assert.equal(sourcePageCount(pdf, 4), 4);
});

test('pageAtSources reparte a página global pelos ficheiros', () => {
  // prova.pdf tem 3 páginas, foto.jpg tem 1, rascunho.pdf tem 2.
  const counts = [3, 1, 2];
  assert.deepEqual(pageAtSources((i) => counts[i], 3, 0), { sourceIndex: 0, page: 1 });
  assert.deepEqual(pageAtSources((i) => counts[i], 3, 2), { sourceIndex: 0, page: 3 });
  assert.deepEqual(pageAtSources((i) => counts[i], 3, 3), { sourceIndex: 1, page: 1 });
  assert.deepEqual(pageAtSources((i) => counts[i], 3, 4), { sourceIndex: 2, page: 1 });
  assert.equal(pageAtSources((i) => counts[i], 3, -1), null);
  assert.equal(pageAtSources((i) => counts[i], 3, 6), null); // além do fim
});

test('flattenSourcePages dá a lista completa na ordem global', () => {
  const pages = flattenSourcePages([pdf, imagem], [2, 1]);
  assert.deepEqual(pages.map((p) => [p.sourceIndex, p.page, p.pageIndex]), [[0, 1, 0], [0, 2, 1], [1, 1, 2]]);
  assert.equal(pages[2].sourceName, imagem.name);
  // contagem omitida conta como 1
  assert.equal(flattenSourcePages([pdf], []).length, 1);
});

test('moveAnnouncement descreve a troca em posições 1-based', () => {
  assert.equal(moveAnnouncement('prova.pdf', 0, 1), '«prova.pdf» passou da posição 1 para a posição 2.');
  assert.equal(moveAnnouncement('foto.jpg', 2, 1), '«foto.jpg» passou da posição 3 para a posição 2.');
});
