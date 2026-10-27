import assert from 'node:assert/strict';
import { test } from 'node:test';
import { camposEscreviveis, dadosParaConcluir, primeiroErro, pertenceA, paraTarefa, temEnvioDeFicheiros, valoresDasVariaveis } from './tarefas.ts';

const schema = {
  components: [
    { type: 'text' },
    { type: 'group', components: [{ type: 'checkbox', key: 'confirmacaoProfessor' }, { type: 'textarea', key: 'parecer' }] },
    { type: 'dynamiclist', key: 'notas', components: [{ type: 'number', key: 'nota' }] },
  ],
};

test('o professor só conclui tarefas suas e ainda por fazer', () => {
  assert.equal(pertenceA({ assignee: '2', state: 'CREATED' }, 2), true);
  assert.equal(pertenceA({ assignee: '3', state: 'CREATED' }, 2), false);
  assert.equal(pertenceA({ assignee: '2', state: 'COMPLETED' }, 2), false);
  assert.equal(pertenceA({ assignee: null, state: 'CREATED' }, 2), false);
});

test('devolve ao concluir só o que o form escreve, em grupos mas sem os filhos de listas', () => {
  const dados = { confirmacaoProfessor: true, parecer: 'ok', notas: [{ nota: 12 }], nota: 99, pautaId: 'PT-1', professorId: 'x' };
  assert.deepEqual(dadosParaConcluir(dados, schema), { confirmacaoProfessor: true, parecer: 'ok', notas: [{ nota: 12 }] });
});

test('um campo de leitura, desactivado ou calculado não se aceita de volta', () => {
  const s = {
    components: [
      { type: 'textfield', key: 'pautaId', readonly: true },
      { type: 'number', key: 'media', disabled: true },
      { type: 'expression', key: 'total' },
      { type: 'textfield', key: 'parecer' },
    ],
  };
  assert.deepEqual(camposEscreviveis(s).map((c) => c.key), ['parecer']);
  assert.deepEqual(dadosParaConcluir({ pautaId: 'OUTRA', media: 20, total: 5, parecer: 'ok' }, s), { parecer: 'ok' });
});

test('o servidor recusa o que falta num campo obrigatório', () => {
  const s = { components: [{ type: 'checkbox', key: 'confirmacao', label: 'Confirmo', validate: { required: true } }, { type: 'textfield', key: 'nota' }] };
  assert.match(primeiroErro({ confirmacao: false }, s) ?? '', /Confirmo/);
  assert.equal(primeiroErro({ confirmacao: true }, s), null);
  assert.match(primeiroErro({}, s) ?? '', /obrigatório/);
});

test('as variáveis chegam como texto JSON e uma truncada fica de fora', () => {
  const v = valoresDasVariaveis([
    { name: 'pautaId', value: '"PT-1"' },
    { name: 'formulaMt', value: '{"pesoMac":1}' },
    { name: 'grande', value: '{"a":', isTruncated: true },
    { name: 'solto', value: 'não é json' },
  ]);
  assert.deepEqual(v, { pautaId: 'PT-1', formulaMt: { pesoMac: 1 }, solto: 'não é json' });
});

test('detecta o envio de ficheiros em qualquer nível', () => {
  assert.equal(temEnvioDeFicheiros(schema), false);
  assert.equal(temEnvioDeFicheiros({ components: [{ type: 'group', components: [{ type: 'filepicker', key: 'f' }] }] }), true);
});

test('a tarefa mostra o processo em linguagem do professor', () => {
  const t = paraTarefa({ userTaskKey: '1', name: 'Validar a pauta', elementId: 'UT_ValidarPauta', processDefinitionId: 'pauta-trimestral', state: 'CREATED', creationDate: '2026-10-27T09:00:00Z', dueDate: null });
  assert.equal(t.processo, 'Pauta do trimestre');
  assert.equal(t.nome, 'Validar a pauta');
  assert.equal(paraTarefa({ userTaskKey: '2', elementId: 'UT_X', processDefinitionId: 'novo', state: 'CREATED', creationDate: 'x' }).nome, 'UT_X');
});
