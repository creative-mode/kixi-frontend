import test from 'node:test';
import assert from 'node:assert/strict';
import { traduzir } from './traducao.ts';

test('os textos do formulário saem em português', () => {
  assert.equal(traduzir('Field is required.'), 'Este campo é obrigatório.');
  assert.equal(traduzir('Add new'), 'Adicionar');
  assert.equal(traduzir('Field must have minimum value of {value}.', { value: 0 }), 'O valor mínimo é 0.');
  assert.equal(traduzir('{page} of {total}', { page: 1, total: 3 }), '1 de 3');
});

test('um texto desconhecido fica como veio e as chaves em falta ficam por preencher', () => {
  assert.equal(traduzir('Something new'), 'Something new');
  assert.equal(traduzir('{page} of {total}', { page: 1 }), '1 de {total}');
});
