import test from 'node:test';
import assert from 'node:assert/strict';
import { assetUrl, pickWidth } from './assets.ts';

test('as imagens enviadas passam pelo prefixo do aluno', () => {
  assert.equal(assetUrl('/uploads/images/post/a.png'), '/aluno/uploads/images/post/a.png');
});

test('endereços completos e vazios ficam como estão', () => {
  assert.equal(assetUrl('https://exemplo.ao/a.png'), 'https://exemplo.ao/a.png');
  assert.equal(assetUrl(null), undefined);
  assert.equal(assetUrl(''), undefined);
});

test('pede a largura certa para o tamanho em que a imagem aparece', () => {
  assert.equal(assetUrl('/uploads/images/avatar/a.png', 44), '/aluno/uploads/images/avatar/a.png?w=96');
  assert.equal(assetUrl('/uploads/images/avatar/a.png', 36), '/aluno/uploads/images/avatar/a.png?w=96');
  assert.equal(assetUrl('/uploads/questions/3/f.png', 300), '/aluno/uploads/questions/3/f.png?w=768');
  assert.equal(assetUrl('https://exemplo.ao/a.png', 44), 'https://exemplo.ao/a.png');
});

test('a largura escolhida cobre o ecrã de densidade 2 e nunca passa do máximo', () => {
  assert.equal(pickWidth(24), 48);
  assert.equal(pickWidth(25), 96);
  assert.equal(pickWidth(96), 192);
  assert.equal(pickWidth(5000), 1280);
});
