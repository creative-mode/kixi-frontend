import test from 'node:test';
import assert from 'node:assert/strict';
import { assetUrl } from './assets.ts';

test('as imagens enviadas passam pelo prefixo do aluno', () => {
  assert.equal(assetUrl('/uploads/images/post/a.png'), '/aluno/uploads/images/post/a.png');
});

test('endereços completos e vazios ficam como estão', () => {
  assert.equal(assetUrl('https://exemplo.ao/a.png'), 'https://exemplo.ao/a.png');
  assert.equal(assetUrl(null), undefined);
  assert.equal(assetUrl(''), undefined);
});
