// Testes dos limites do upload OCR:  node --test lib/crud/ocr-files.test.ts
//
// Os limites são os do backend (10 ficheiros, jpg/png/pdf/webp/bmp/tiff, 50 MB no
// total). Aceitar mais no cliente era deixar o professor esperar pelo upload para
// levar um 400 no fim.
import test from 'node:test';
import assert from 'node:assert/strict';
import { addOcrFiles, ocrFilesProblem, OCR_MAX_FILES } from './ocr-files.ts';

const MB = 1024 * 1024;
const f = (name: string, mb = 1) => ({ name, size: mb * MB });

test('aceita as extensões do backend, sem olhar para maiúsculas', () => {
  const { files, rejected } = addOcrFiles([], [f('a.JPG'), f('b.pdf'), f('c.tif'), f('d.webp')]);
  assert.equal(files.length, 4);
  assert.deepEqual(rejected, []);
});

test('recusa o que o backend recusa: GIF, HEIC e afins', () => {
  const { files, rejected } = addOcrFiles([], [f('a.gif'), f('foto.heic')]);
  assert.equal(files.length, 0);
  assert.equal(rejected.length, 2);
});

test('uma fotografia de telemóvel de 4 MB passa; um ficheiro de 16 MB não', () => {
  const { files, rejected } = addOcrFiles([], [f('foto.jpg', 4), f('scan.pdf', 16)]);
  assert.deepEqual(files.map((x) => x.name), ['foto.jpg']);
  assert.deepEqual(rejected, ['«scan.pdf» ultrapassa os 15 MB.']);
});

test('no máximo 10 ficheiros, contando os que já lá estavam', () => {
  const current = Array.from({ length: 9 }, (_, i) => f(`p${i}.png`));
  const { files, rejected } = addOcrFiles(current, [f('x.png'), f('y.png')]);
  assert.equal(files.length, OCR_MAX_FILES);
  assert.equal(rejected.length, 1);
});

test('o total não passa dos 50 MB', () => {
  const { files, rejected } = addOcrFiles([], [f('a.pdf', 15), f('b.pdf', 15), f('c.pdf', 15), f('d.pdf', 10)]);
  assert.equal(files.length, 3);
  assert.equal(rejected.length, 1);
});

test('ocrFilesProblem: nenhum ficheiro, ou a primeira razão', () => {
  assert.equal(ocrFilesProblem([]), 'Escolha pelo menos um ficheiro.');
  assert.equal(ocrFilesProblem([f('a.png')]), null);
  assert.match(ocrFilesProblem([f('a.gif')]) ?? '', /só são aceites/);
});
