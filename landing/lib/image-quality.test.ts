import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assessPixels, messageFor } from './image-quality.ts';

type Paint = (x: number, y: number) => [number, number, number];

function image(w: number, h: number, paint: Paint) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const [r, g, b] = paint(x, y);
      const i = (y * w + x) * 4;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = 255;
    }
  }
  return data;
}

const WHITE: [number, number, number] = [250, 250, 248];
const INK: [number, number, number] = [20, 20, 25];

/** Folha clara com linhas de «texto»: barras escuras curtas em linhas regulares, em pé. */
const text: Paint = (x, y) => (y % 24 < 8 && x > 60 && x < 540 && (x * 7 + Math.floor(y / 24) * 13) % 41 < 30 ? INK : WHITE);
/** O mesmo texto, rodado um quarto de volta. */
const sideways: Paint = (x, y) => text(y, x);

const W = 600;
const H = 800;

test('uma folha com linhas de texto, em pé e nítida, passa', () => {
  const a = assessPixels(image(W, H, text), W, H, 1200, 1600);
  assert.equal(a.verdict, 'ok', a.reasons.join());
});

test('a folha em branco é recusada', () => {
  const a = assessPixels(image(W, H, () => WHITE), W, H, 1200, 1600);
  assert.equal(a.verdict, 'reject');
  assert.ok(a.reasons.includes('blank'));
});

test('uma foto escura é recusada', () => {
  const a = assessPixels(image(W, H, () => [18, 18, 20]), W, H, 1200, 1600);
  assert.ok(a.reasons.includes('dark'));
});

test('o texto de lado é recusado, com o conselho de tirar a foto em pé', () => {
  const a = assessPixels(image(H, W, sideways), H, W, 1600, 1200);
  assert.equal(a.verdict, 'reject');
  assert.ok(a.reasons.includes('sideways'));
  assert.match(messageFor(a) ?? '', /em pé/);
});

test('uma imagem colorida sem texto não é um enunciado', () => {
  const a = assessPixels(image(W, H, (x, y) => [(x * 3) % 256, 120 + ((y * 2) % 100), 200 - ((x + y) % 120)]), W, H, 1200, 1600);
  assert.ok(a.reasons.includes('not-document'));
});

test('uma imagem pequena demais é recusada', () => {
  const a = assessPixels(image(W, H, text), W, H, 300, 400);
  assert.ok(a.reasons.includes('tiny'));
});

test('uma foto desfocada é recusada', () => {
  const soft: Paint = (x, y) => {
    const v = 235 - 40 * Math.sin(y / 9) * Math.sin(x / 13);
    return [v, v, v];
  };
  const a = assessPixels(image(W, H, soft), W, H, 1200, 1600);
  assert.equal(a.verdict, 'reject');
});
