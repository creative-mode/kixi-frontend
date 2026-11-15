import assert from 'node:assert/strict';
import { test } from 'node:test';
import { nomeDoCampo, camposEscreviveis, dadosParaConcluir, primeiroErro, pertenceA, paraTarefa, temEnvioDeFicheiros, tituloDaTarefa, valoresDasVariaveis } from './tarefas.ts';

const schema = {
  components: [
    { type: 'text' },
    { type: 'group', components: [{ type: 'checkbox', key: 'confirmacaoProfessor' }, { type: 'textarea', key: 'parecer' }] },
    { type: 'dynamiclist', path: 'notas', components: [{ type: 'number', key: 'nota' }] },
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
  const t = paraTarefa({ userTaskKey: '1', name: 'Validar a pauta', elementId: 'UT_ValidarPauta', processDefinitionId: 'pauta-trimestral', processInstanceKey: '100', state: 'CREATED', creationDate: '2026-10-27T09:00:00Z', dueDate: null });
  assert.equal(t.processo, 'Pauta do trimestre');
  assert.equal(t.nome, 'Validar a pauta');
  assert.equal(paraTarefa({ userTaskKey: '2', elementId: 'UT_X', processDefinitionId: 'novo', processInstanceKey: '101', state: 'CREATED', creationDate: 'x' }).nome, 'UT_X');
});

// kixi-frontend#774: a lista não dizia a que prova (P1/P2) ou avaliação (MAC) cada tarefa se referia.
test('uma tarefa de prova mostra o componente, ou o título quando o motor o tiver, com a turma/disciplina', () => {
  assert.equal(
    tituloDaTarefa('minipauta-prova', { prova: { componente: 'P1' }, pauta: { turma: '11ª B', disciplina: 'Matemática' } }),
    'Prova P1 · Matemática · 11ª B',
  );
  assert.equal(
    tituloDaTarefa('minipauta-prova', { prova: { componente: 'P2', titulo: 'Exame de recurso' }, pauta: { turma: '11ª B', disciplina: 'Matemática' } }),
    'Exame de recurso · Matemática · 11ª B',
  );
  // Sem `prova`, cai para o `provaId` solto.
  assert.equal(tituloDaTarefa('minipauta-prova', { provaId: 42, pauta: { disciplina: 'Física' } }), 'Prova 42 · Física');
});

test('uma tarefa da MAC mostra o título da avaliação com a turma/disciplina', () => {
  assert.equal(
    tituloDaTarefa('minipauta-mac', { avaliacaoContinua: { titulo: 'Trabalho 1' }, pauta: { turma: '10ª A', disciplina: 'Português' } }),
    'Trabalho 1 · Português · 10ª A',
  );
  assert.equal(tituloDaTarefa('minipauta-mac', { avaliacaoContinua: 'Ficha 2' }), 'Ficha 2');
});

test('sem dados suficientes, nada se inventa', () => {
  assert.equal(tituloDaTarefa('minipauta-prova', {}), null);
  assert.equal(tituloDaTarefa('minipauta-mac', {}), null);
  assert.equal(tituloDaTarefa('correcao-prova', {}), null);
  // A correcção e a reclamação não são destas duas famílias, mas partilham a turma/disciplina da pauta.
  assert.equal(tituloDaTarefa('correcao-prova', { pauta: { turma: '12ª C' } }), '12ª C');
});

test('paraTarefa junta o detalhe da tarefa a partir das variáveis do processo', () => {
  const t = paraTarefa(
    { userTaskKey: '3', name: 'Rever e confirmar a mini-pauta', elementId: 'UT_RevisaoMini', processDefinitionId: 'minipauta-prova', processInstanceKey: '200', state: 'CREATED', creationDate: '2026-10-27T09:00:00Z', dueDate: null },
    { prova: { componente: 'P1' }, pauta: { turma: '11ª B', disciplina: 'Matemática' } },
  );
  assert.equal(t.detalhe, 'Prova P1 · Matemática · 11ª B');
  // Sem o segundo argumento (variaveis ainda por chegar), o detalhe fica null em vez de rebentar.
  assert.equal(paraTarefa({ userTaskKey: '4', elementId: 'UT_X', processDefinitionId: 'minipauta-mac', processInstanceKey: '201', state: 'CREATED', creationDate: 'x' }).detalhe, null);
});

// A forma real dos forms do SchoolOps (definir-avaliacoes-continuas.form): a lista dinâmica liga-se por `path`, não por `key`.
const avaliacoesContinuas = {
  components: [
    { type: 'text', text: 'Defina as avaliações' },
    {
      type: 'dynamiclist',
      label: 'Avaliações',
      path: 'avaliacoesContinuas',
      isRepeating: true,
      validate: { required: true },
      components: [
        { type: 'textfield', key: 'titulo', validate: { required: true } },
        { type: 'datetime', key: 'data', subtype: 'date', validate: { required: true } },
      ],
    },
  ],
};

test('uma lista dinâmica liga-se por path e volta ao Camunda (era deitada fora)', () => {
  assert.deepEqual(camposEscreviveis(avaliacoesContinuas).map(nomeDoCampo), ['avaliacoesContinuas']);
  const lista = [{ titulo: 'Teste curto 1', data: '2026-11-20' }];
  assert.deepEqual(dadosParaConcluir({ avaliacoesContinuas: lista, titulo: 'solto', pautaId: 'PT-1' }, avaliacoesContinuas), {
    avaliacoesContinuas: lista,
  });
});

test('o servidor exige a lista obrigatória, também por path', () => {
  assert.match(primeiroErro({}, avaliacoesContinuas) ?? '', /Avaliações/);
  assert.match(primeiroErro({ avaliacoesContinuas: [] }, avaliacoesContinuas) ?? '', /obrigatório/);
  assert.equal(primeiroErro({ avaliacoesContinuas: [{ titulo: 'x', data: '2026-11-20' }] }, avaliacoesContinuas), null);
});

test('um grupo com caminho conta pelo caminho; um sem caminho só agrupa', () => {
  const s = {
    components: [
      { type: 'group', path: 'cabecalho', components: [{ type: 'textfield', key: 'titulo' }] },
      { type: 'group', components: [{ type: 'textfield', key: 'parecer' }] },
      { type: 'textfield', key: 'dados.nota' },
    ],
  };
  assert.deepEqual(camposEscreviveis(s).map(nomeDoCampo), ['cabecalho', 'parecer', 'dados.nota']);
  assert.deepEqual(dadosParaConcluir({ cabecalho: { titulo: 'x' }, parecer: 'ok', dados: { nota: 5 }, pautaId: 'PT-1' }, s), {
    cabecalho: { titulo: 'x' },
    parecer: 'ok',
    dados: { nota: 5 },
  });
});
