import test from 'node:test';
import assert from 'node:assert/strict';

import { initials, photoUrl, safePhoto } from './profile.ts';

// Este ficheiro não existia (#344). `photoUrl` decide que endereço de foto entra no
// `<img>`, e o que ele não aceita tem de acabar em `null` — um endereço vindo do
// servidor é exactamente o sítio onde um `javascript:` se esconderia. Sem teste,
// nada impedia o regex de afrouxar.

test('photoUrl aceita um caminho do backend', () => {
  assert.equal(photoUrl({ photo: '/uploads/images/avatar/abc-123.png' } as never), '/uploads/images/avatar/abc-123.png');
  assert.equal(photoUrl({ photo: '/uploads/images/avatar/Ana.Verde.webp' } as never), '/uploads/images/avatar/Ana.Verde.webp');
});

test('photoUrl aceita um endereço http(s)', () => {
  assert.equal(photoUrl({ photo: 'https://kixi.ao/uploads/a.png' } as never), 'https://kixi.ao/uploads/a.png');
  assert.equal(photoUrl({ photo: 'http://kixi.ao/uploads/a.png' } as never), 'http://kixi.ao/uploads/a.png');
});

test('photoUrl recusa um esquema perigoso', () => {
  // O ponto do ficheiro: um endereço é dado pelo servidor, e um `javascript:` ou
  // um `data:` num `src` não é uma fotografia.
  assert.equal(photoUrl({ photo: 'javascript:alert(1)' } as never), null);
  assert.equal(photoUrl({ photo: 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=' } as never), null);
});

test('photoUrl recusa um caminho que não é de avatar', () => {
  assert.equal(photoUrl({ photo: '/etc/passwd' } as never), null);
  assert.equal(photoUrl({ photo: '/uploads/images/avatar/../../etc/passwd' } as never), null);
  assert.equal(photoUrl({ photo: '/uploads/provas/1.pdf' } as never), null);
});

test('photoUrl devolve null sem foto, e apara espaços', () => {
  assert.equal(photoUrl(null), null);
  assert.equal(photoUrl({} as never), null);
  assert.equal(photoUrl({ photo: '   ' } as never), null);
  assert.equal(photoUrl({ photo: '' } as never), null);
  // Um `\n` à frente não pode ficar no `src`: às vezes o atributo parte-se e o
  // browser lê só a primeira linha.
  assert.equal(photoUrl({ photo: '\n/uploads/images/avatar/a.png' } as never), '/uploads/images/avatar/a.png');
});

test('initials dá as iniciais do primeiro e do último nome', () => {
  assert.equal(initials('Ana Verde'), 'AV');
  assert.equal(initials('  ana   verde  '), 'AV');
  assert.equal(initials('Abner'), 'A');
  assert.equal(initials(''), '');
});
test('safePhoto serve as fotos dos outros: aceita só o que photoUrl aceita e esvazia o resto (#345)', () => {
  assert.equal(safePhoto('/uploads/images/avatar/abc-123.png'), '/uploads/images/avatar/abc-123.png');
  assert.equal(safePhoto('https://cdn.exemplo.ao/a.png'), 'https://cdn.exemplo.ao/a.png');
  assert.equal(safePhoto('  '), null);
  assert.equal(safePhoto(null), null);
  assert.equal(safePhoto(undefined), null);
  assert.equal(safePhoto('javascript:alert(1)'), null);
  assert.equal(safePhoto('/uploads/images/avatar/../../etc/passwd'), null);
});
