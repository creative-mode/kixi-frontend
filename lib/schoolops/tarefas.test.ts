import assert from 'node:assert/strict';
import { test } from 'node:test';
import { componenteDaProva, nomeDoCampo, camposEscreviveis, dadosParaConcluir, primeiroErro, pertenceA, paraTarefa, temEnvioDeFicheiros, tituloDaTarefa, valoresDasVariaveis } from './tarefas.ts';

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

test('uma avaliação de MAC com enunciado corre o mesmo processo da P1/P2: reconhece-se por tipoProva, não pelo processo (kixi-frontend#809)', () => {
  // `minipauta-prova` (validar/homologar) e `correcao-prova` (recolher/corrigir) mostram-se da mesma forma.
  assert.equal(
    tituloDaTarefa('minipauta-prova', { tipoProva: 'AVALIACAO_CONTINUA', pauta: { turma: '10ª A', disciplina: 'Português' } }, 'Trabalho 1'),
    'Avaliação contínua: Trabalho 1 · Português · 10ª A',
  );
  assert.equal(
    tituloDaTarefa('correcao-prova', { tipoProva: 'AVALIACAO_CONTINUA' }, 'Trabalho 1'),
    'Avaliação contínua: Trabalho 1',
  );
  // O motor não traz o título como variável leve: sem o título resolvido pelo chamador, mostra-se o genérico.
  assert.equal(tituloDaTarefa('correcao-prova', { tipoProva: 'AVALIACAO_CONTINUA' }), 'Avaliação contínua');
  // Nunca "Prova P1"/"Prova P2" para uma avaliação contínua, mesmo que `prova` venha preenchida.
  assert.equal(
    tituloDaTarefa('minipauta-prova', { tipoProva: 'AVALIACAO_CONTINUA', prova: { componente: 'P1' } }, 'Trabalho 1'),
    'Avaliação contínua: Trabalho 1',
  );
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
  // Uma avaliação de MAC em correcao-prova, com o título resolvido à parte pelo enunciado no Kixi (kixi-frontend#809).
  const mac = paraTarefa(
    { userTaskKey: '5', elementId: 'UT_RecolherFolhas', processDefinitionId: 'correcao-prova', processInstanceKey: '202', state: 'CREATED', creationDate: 'x' },
    { tipoProva: 'AVALIACAO_CONTINUA', provaId: 77, pauta: { turma: '10ª A', disciplina: 'Português' } },
    'Trabalho 1',
  );
  assert.equal(mac.detalhe, 'Avaliação contínua: Trabalho 1 · Português · 10ª A');
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

// V2-10: as tarefas da P1 e da P2 («Recolher e conferir folhas», «Digitalizar as folhas») tinham o mesmo título. O dado vem
// da própria instância: `componentes` (npp = prova P1, npt = prova P2, cada uma com o `provaId`) e o `provaId` da tarefa.
const PAUTA = { turma: 'E2EBT2', disciplina: 'E2E-Português B' };
const COMPONENTES = { npp: { provaId: '135' }, npt: { provaId: '136' }, macDispensada: false };

test('a prova da tarefa (P1 ou P2) sai de `componentes` e do `provaId` da instância', () => {
  assert.equal(componenteDaProva({ provaId: '135', componentes: COMPONENTES }), 'P1');
  assert.equal(componenteDaProva({ provaId: '136', componentes: COMPONENTES }), 'P2');
  assert.equal(componenteDaProva({ provaId: 136, componentes: COMPONENTES }), 'P2');
  assert.equal(componenteDaProva({ provaId: '999', componentes: COMPONENTES }), null, 'uma prova que não é de nenhuma componente não se inventa');
  assert.equal(componenteDaProva({ provaId: '135' }), null);
  assert.equal(componenteDaProva({ provaId: '135', componentes: 'x' }), null);
  assert.equal(componenteDaProva({ provaId: '135', componentes: { npp: {}, npt: { provaId: null } } }), null);
  assert.equal(componenteDaProva({}), null);
});

test('uma avaliação de MAC nunca vira P1 nem P2', () => {
  assert.equal(componenteDaProva({ provaId: '135', componentes: COMPONENTES, tipoProva: 'AVALIACAO_CONTINUA' }), null);
});

test('as tarefas da P1 e da P2 do mesmo plano distinguem-se no título', () => {
  const p1 = tituloDaTarefa('correcao-prova', { provaId: '135', componentes: COMPONENTES, tipoProva: 'PROVA_PROFESSOR', pauta: PAUTA });
  const p2 = tituloDaTarefa('correcao-prova', { provaId: '136', componentes: COMPONENTES, tipoProva: 'PROVA_TRIMESTRAL', pauta: PAUTA });
  assert.equal(p1, 'Prova P1 · E2E-Português B · E2EBT2');
  assert.equal(p2, 'Prova P2 · E2E-Português B · E2EBT2');
  assert.notEqual(p1, p2);
});

test('sem os dados da instância o título fica como estava (turma e disciplina)', () => {
  assert.equal(tituloDaTarefa('correcao-prova', { pauta: PAUTA }), 'E2E-Português B · E2EBT2');
  assert.equal(tituloDaTarefa('correcao-prova', { provaId: '999', componentes: COMPONENTES, pauta: PAUTA }), 'E2E-Português B · E2EBT2');
});

// schoolops#88: a pauta trimestral é da disciplina inteira; o `provaId` herdado não a faz parecer «Prova P1».
test('a tarefa da pauta trimestral nunca se descreve como Prova P1/P2', () => {
  assert.equal(
    tituloDaTarefa('pauta-trimestral', { provaId: '135', componentes: COMPONENTES, pauta: PAUTA }),
    'E2E-Português B · E2EBT2',
  );
  assert.equal(tituloDaTarefa('pauta-trimestral', { provaId: '135', componentes: COMPONENTES }), null);
});

test('G1: leituras sem aluno ou ainda por carregar não se concluem', async () => {
  const { problemaDasLeituras, pedeLeituras } = await import('./tarefas.ts');
  const schema = { components: [{ type: 'dynamiclist', path: 'leituras', components: [{ type: 'number', key: 'alunoId' }] }] };
  assert.equal(pedeLeituras(schema), true);
  assert.match(problemaDasLeituras({}, schema) ?? '', /ainda não chegaram/);
  assert.match(problemaDasLeituras({ leituras: [{ alunoId: null }] }, schema) ?? '', /sem aluno/);
  assert.match(problemaDasLeituras({ leituras: [{ alunoId: 8 }, { alunoId: null }, {}] }, schema) ?? '', /2 leituras sem aluno/);
  assert.equal(problemaDasLeituras({ leituras: [{ alunoId: 8 }] }, schema), null);
  assert.equal(problemaDasLeituras({}, { components: [{ type: 'textfield', key: 'x' }] }), null);
});

test('G2: o total de folhas tem de bater com os presentes', async () => {
  const { problemaDasFolhasRecolhidas } = await import('./tarefas.ts');
  const quatro = [{ presente: true }, { presente: true }, { presente: true }, { presente: true }, { presente: false }];
  assert.match(problemaDasFolhasRecolhidas({ entregas: quatro, folhasRecolhidas: 3 }) ?? '', /\(3\).*\(4\)/);
  assert.equal(problemaDasFolhasRecolhidas({ entregas: quatro, folhasRecolhidas: 4 }), null);
  assert.equal(problemaDasFolhasRecolhidas({ entregas: quatro, folhasRecolhidas: '4' }), null);
  assert.equal(problemaDasFolhasRecolhidas({ folhasRecolhidas: 1 }), null);
});

test('G13: o filtro separa por processo e por prazo', async () => {
  const { filtrarTarefas, SEM_FILTRO } = await import('./tarefas.ts');
  const base = { key: '1', nome: 'n', elemento: 'e', criadaEm: '2026-01-01', detalhe: null };
  const lista = [
    { ...base, key: 'a', processo: 'Prova', prazo: '2026-01-10T00:00:00Z' },
    { ...base, key: 'b', processo: 'Prova', prazo: '2099-01-10T00:00:00Z' },
    { ...base, key: 'c', processo: 'Pauta do trimestre', prazo: null },
  ];
  const agora = Date.parse('2026-06-01T00:00:00Z');
  assert.equal(filtrarTarefas(lista, SEM_FILTRO, agora).length, 3);
  assert.deepEqual(filtrarTarefas(lista, { processo: 'Prova', prazo: 'todas' }, agora).map((t) => t.key), ['a', 'b']);
  assert.deepEqual(filtrarTarefas(lista, { processo: '', prazo: 'atrasadas' }, agora).map((t) => t.key), ['a']);
  assert.deepEqual(filtrarTarefas(lista, { processo: '', prazo: 'em-prazo' }, agora).map((t) => t.key), ['b', 'c']);
});
