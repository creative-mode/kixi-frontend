import assert from 'node:assert/strict';
import { test } from 'node:test';
import { imagesFrom } from './clipboard-images.ts';

const file = (type: string, name: string) => ({ kind: 'file', type, getAsFile: () => new File(['x'], name, { type }) });
const text = { kind: 'string', type: 'text/plain', getAsFile: () => null };
const fileWithoutData = { kind: 'file', type: 'image/png', getAsFile: () => null };

test('só as imagens entram; o texto e os outros ficheiros são ignorados em silêncio', () => {
  const got = imagesFrom([text, file('image/png', 'captura.png'), file('application/pdf', 'prova.pdf')]);
  assert.deepEqual(got.map((f) => f.name), ['captura.png']);
});

test('um item de imagem sem ficheiro anexado não entra', () => {
  assert.deepEqual(imagesFrom([fileWithoutData]), []);
});

test('sem nada colado, não entra nada', () => {
  assert.deepEqual(imagesFrom([]), []);
});
