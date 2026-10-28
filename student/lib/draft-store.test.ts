import assert from 'node:assert/strict';
import { test } from 'node:test';
import { aRecuperar, chaveRascunho, guardarRascunho, lerRascunho, limparRascunho, VALIDADE_MS, type Armazem } from './draft-store.ts';

function armazem(): Armazem & { dados: Map<string, string> } {
  const dados = new Map<string, string>();
  return {
    dados,
    getItem: (k) => dados.get(k) ?? null,
    setItem: (k, v) => void dados.set(k, v),
    removeItem: (k) => void dados.delete(k),
  };
}

test('guarda e lê o que está por confirmar, por simulação', () => {
  const a = armazem();
  guardarRascunho(a, 7, { 1: { optionId: 3, text: '' }, 2: { optionId: null, text: 'a minha resposta' } }, 1000);
  assert.deepEqual(lerRascunho(a, 7, 2000), { 1: { optionId: 3, text: '' }, 2: { optionId: null, text: 'a minha resposta' } });
  assert.deepEqual(lerRascunho(a, 8, 2000), {}); // outra simulação não vê esta
});

test('sem respostas por confirmar apaga a entrada', () => {
  const a = armazem();
  guardarRascunho(a, 7, { 1: { optionId: 3, text: '' } }, 1000);
  guardarRascunho(a, 7, {}, 1500);
  assert.equal(a.dados.has(chaveRascunho(7)), false);
});

test('um rascunho expirado não se restaura e é apagado', () => {
  const a = armazem();
  guardarRascunho(a, 7, { 1: { optionId: 3, text: '' } }, 1000);
  assert.deepEqual(lerRascunho(a, 7, 1000 + VALIDADE_MS + 1), {});
  assert.equal(a.dados.has(chaveRascunho(7)), false);
});

test('lixo, versão desconhecida ou JSON estragado dão vazio e limpam', () => {
  const a = armazem();
  for (const bruto of ['não é json', '{"v":99,"em":1,"respostas":{}}', '{"v":1,"em":"x","respostas":{}}', '{"v":1,"em":1,"respostas":null}']) {
    a.setItem(chaveRascunho(7), bruto);
    assert.deepEqual(lerRascunho(a, 7, 2), {}, bruto);
    assert.equal(a.dados.has(chaveRascunho(7)), false, bruto);
  }
});

test('entradas inválidas dentro de um rascunho bom são ignoradas, as boas ficam', () => {
  const a = armazem();
  a.setItem(chaveRascunho(7), JSON.stringify({
    v: 1, em: 1,
    respostas: { 1: { optionId: 3, text: 'ok' }, 2: { optionId: 'x', text: 'mau' }, abc: { optionId: null, text: 'mau' }, 3: { optionId: null, text: 'a'.repeat(20_001) }, 4: 'lixo' },
  }));
  assert.deepEqual(lerRascunho(a, 7, 2), { 1: { optionId: 3, text: 'ok' } });
});

test('um armazém que falha (cheio ou modo privado) não rebenta a prova', () => {
  const avariado: Armazem = {
    getItem: () => { throw new Error('bloqueado'); },
    setItem: () => { throw new Error('cheio'); },
    removeItem: () => { throw new Error('bloqueado'); },
  };
  assert.doesNotThrow(() => guardarRascunho(avariado, 7, { 1: { optionId: 1, text: '' } }));
  assert.deepEqual(lerRascunho(avariado, 7), {});
  assert.doesNotThrow(() => limparRascunho(avariado, 7));
});

test('a recuperar: só o que existe na prova, não está vazio e difere do servidor', () => {
  const rascunho = {
    1: { optionId: 3, text: '' }, // igual ao servidor: nada a fazer
    2: { optionId: null, text: 'mais recente que o servidor' }, // difere
    3: { optionId: null, text: '   ' }, // vazia
    4: { optionId: 9, text: '' }, // questão que já não existe
    5: { optionId: 2, text: '' }, // o servidor não tem nada
  };
  const servidor = { 1: { optionId: 3, text: '' }, 2: { optionId: null, text: 'antiga' } };
  assert.deepEqual(aRecuperar(rascunho, [1, 2, 3, 5], servidor), {
    2: { optionId: null, text: 'mais recente que o servidor' },
    5: { optionId: 2, text: '' },
  });
});
