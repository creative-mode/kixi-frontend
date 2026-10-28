import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chaveMarcadas, guardarMarcadas, lerMarcadas, limparMarcadas } from './flag-store.ts';
import type { Armazem } from './draft-store.ts';

function armazem(): Armazem & { dados: Map<string, string> } {
  const dados = new Map<string, string>();
  return {
    dados,
    getItem: (k) => dados.get(k) ?? null,
    setItem: (k, v) => void dados.set(k, v),
    removeItem: (k) => void dados.delete(k),
  };
}

test('guarda e lê as marcações, por simulação e sem repetições', () => {
  const a = armazem();
  guardarMarcadas(a, 7, [3, 1, 3]);
  assert.deepEqual([...lerMarcadas(a, 7)], [1, 3]);
  assert.deepEqual([...lerMarcadas(a, 8)], []); // outra simulação não vê estas
});

test('sem marcações apaga a entrada', () => {
  const a = armazem();
  guardarMarcadas(a, 7, [1]);
  guardarMarcadas(a, 7, []);
  assert.equal(a.dados.has(chaveMarcadas(7)), false);
});

test('lixo, versão desconhecida ou JSON estragado dão vazio e limpam', () => {
  const a = armazem();
  for (const bruto of ['não é json', '{"v":99,"marcadas":[1]}', '{"v":1,"marcadas":"1,2"}', '{"v":1,"marcadas":null}']) {
    a.setItem(chaveMarcadas(7), bruto);
    assert.deepEqual([...lerMarcadas(a, 7)], [], bruto);
    assert.equal(a.dados.has(chaveMarcadas(7)), false, bruto);
  }
});

test('ids inválidos dentro de uma lista boa são ignorados, os bons ficam', () => {
  const a = armazem();
  a.setItem(chaveMarcadas(7), JSON.stringify({ v: 1, marcadas: [2, 0, -1, 1.5, '3', null, 4] }));
  assert.deepEqual([...lerMarcadas(a, 7)], [2, 4]);
});

test('um armazém que falha não rebenta a prova', () => {
  const avariado: Armazem = {
    getItem: () => { throw new Error('bloqueado'); },
    setItem: () => { throw new Error('cheio'); },
    removeItem: () => { throw new Error('bloqueado'); },
  };
  assert.doesNotThrow(() => guardarMarcadas(avariado, 7, [1]));
  assert.deepEqual([...lerMarcadas(avariado, 7)], []);
  assert.doesNotThrow(() => limparMarcadas(avariado, 7));
});
