'use server';

// Tarefas do SchoolOps do professor: pautas, correcções e reclamações. O processo corre no Camunda; aqui o professor vê
// as suas tarefas e conclui-as com o form do próprio processo, no desenho do Kixi.

import { getCurrentUser } from '@/lib/auth.server';
import { call, fail, ok, type Result } from '@/lib/crud/http';
import {
  CamundaErro,
  carregarDocumento,
  concluirTarefa,
  obterFormulario,
  obterTarefa,
  tarefasDoProfessor,
  variaveisDaTarefa,
  variaveisDasTarefas,
} from '@/lib/schoolops/camunda';
import { campoDeFicheiros, problemaDasFolhas, referenciasRecebidas, tipoPeloConteudo, variaveisDeConclusao, type ReferenciaDocumento } from '@/lib/schoolops/folhas';
import {
  dadosParaConcluir,
  paraTarefa,
  primeiroErro,
  pertenceA,
  temEnvioDeFicheiros,
  valoresDasVariaveis,
  type Componente,
  type Tarefa,
} from '@/lib/schoolops/tarefas';

export type TarefaAberta = {
  tarefa: Tarefa;
  schema: Componente | null;
  dados: Record<string, unknown>;
  /** O form pede ficheiros (as folhas digitalizadas): o ecrã mostra o carregador em vez do formulário. */
  precisaDeFicheiros: boolean;
};

const SEM_SERVICO = 'Não foi possível comunicar com o serviço de tarefas. Tente de novo dentro de instantes.';

/** O detalhe de uma falha do Camunda fica no registo do servidor; o professor só vê uma mensagem sem pormenores da infraestrutura. */
async function protegido<T>(fn: () => Promise<Result<T>>): Promise<Result<T>> {
  try {
    return await fn();
  } catch (e) {
    const msg = String((e as Error)?.message ?? '');
    if (msg.includes('Não autenticado')) return fail('Sessão expirada. Inicie sessão novamente.');
    console.error('[schoolops] tarefas:', msg);
    return fail(SEM_SERVICO);
  }
}

/** Professores, coordenadores e administradores; a conta de quem faz a tarefa é o assignee dela (o motor atribui a homologação ao coordenador). */
async function professor(): Promise<number> {
  const user = await getCurrentUser();
  if (!user || !(user.roles.includes('TEACHER') || user.roles.includes('COORDINATOR') || user.roles.includes('ADMIN'))) throw new Error('Não autenticado');
  return user.accountId;
}

export type ListaDeTarefas = { tarefas: Tarefa[]; total: number };

/**
 * O título de cada avaliação de MAC com enunciado (kixi-frontend#809): o motor não traz o título como variável leve da
 * tarefa (só `provaId`, o id do enunciado, e `tipoProva = AVALIACAO_CONTINUA`), por isso pede-se ao próprio Kixi, pelos
 * `provaId` em causa. Nunca falha a lista inteira por isto: sem título, `tituloDaTarefa` mostra "Avaliação contínua" liso.
 */
async function titulosDasAvaliacoesContinuas(variaveis: Record<string, Record<string, unknown>>): Promise<Map<string, string>> {
  const ids = new Set<string>();
  for (const v of Object.values(variaveis)) {
    if (v.tipoProva === 'AVALIACAO_CONTINUA' && v.provaId != null) ids.add(String(v.provaId));
  }
  if (ids.size === 0) return new Map();
  try {
    const res = await call('/api/v1/statements');
    if (!res.ok) return new Map();
    const statements = (await res.json()) as { id: number | string; title?: string }[];
    return new Map(statements.filter((s) => ids.has(String(s.id))).map((s) => [String(s.id), String(s.title ?? `Enunciado ${s.id}`)]));
  } catch (e) {
    console.warn('[schoolops] títulos das avaliações contínuas indisponíveis; a lista segue sem título:', (e as Error)?.message);
    return new Map();
  }
}

export async function listarTarefas(): Promise<Result<ListaDeTarefas>> {
  return protegido(async () => {
    const { items, total } = await tarefasDoProfessor(await professor());
    // Uma só pesquisa de variáveis para todas as tarefas da lista (kixi-frontend#774), não uma por tarefa.
    // O detalhe é cosmético: se o motor rejeitar o filtro, devolver um formato inesperado ou estiver em
    // baixo, a lista continua a existir sem ele, em vez de a tarefa inteira falhar por isso.
    let variaveis: Record<string, Record<string, unknown>> = {};
    try {
      variaveis = await variaveisDasTarefas(items.map((t) => t.processInstanceKey));
    } catch (e) {
      console.warn('[schoolops] variáveis das tarefas indisponíveis; a lista segue sem detalhe:', (e as Error)?.message);
    }
    const titulos = await titulosDasAvaliacoesContinuas(variaveis);
    return ok({
      tarefas: items.map((t) => {
        const v = variaveis[t.processInstanceKey] ?? {};
        return paraTarefa(t, v, v.provaId != null ? titulos.get(String(v.provaId)) : undefined);
      }),
      total,
    });
  });
}

export async function abrirTarefa(key: string): Promise<Result<TarefaAberta>> {
  return protegido(async () => {
    const conta = await professor();
    const t = await obterTarefa(key);
    // Uma tarefa de outro professor responde como se não existisse.
    if (!pertenceA(t, conta)) return fail('Tarefa não encontrada ou já concluída.');
    const [formulario, variaveis] = await Promise.all([obterFormulario(key), variaveisDaTarefa(key)]);
    return ok({
      tarefa: paraTarefa(t),
      schema: formulario?.schema ?? null,
      dados: valoresDasVariaveis(variaveis),
      precisaDeFicheiros: formulario ? temEnvioDeFicheiros(formulario.schema) : false,
    });
  });
}

export async function concluir(key: string, dados: Record<string, unknown>): Promise<Result<undefined>> {
  return protegido(async () => {
    const conta = await professor();
    const t = await obterTarefa(key);
    if (!pertenceA(t, conta)) return fail('Tarefa não encontrada ou já concluída.');
    const formulario = await obterFormulario(key);
    if (!formulario) return fail('Esta tarefa não tem formulário.');
    if (temEnvioDeFicheiros(formulario.schema)) return fail('Esta tarefa pede ficheiros: carregue as folhas no ecrã da tarefa.');
    const erro = primeiroErro(dados, formulario.schema);
    if (erro) return fail(erro);
    // Só se devolvem os campos de entrada do form (não os de leitura nem os calculados): o professor não altera as outras
    // variáveis do processo.
    await concluirTarefa(key, dadosParaConcluir(dados, formulario.schema));
    return ok(undefined);
  });
}

/** A tarefa é do professor e o seu form pede ficheiros: devolve o nome do campo. Cada passo do envio repete esta verificação. */
async function tarefaDeFolhas(key: string): Promise<Result<string>> {
  const conta = await professor();
  const t = await obterTarefa(key);
  if (!pertenceA(t, conta)) return fail('Tarefa não encontrada ou já concluída.');
  const formulario = await obterFormulario(key);
  const campo = formulario ? campoDeFicheiros(formulario.schema) : null;
  if (!campo) return fail('Esta tarefa não pede folhas digitalizadas.');
  return ok(campo);
}

/**
 * Passo 1 do envio (kixi-frontend#838): um ficheiro de cada vez, para o ecrã mostrar o progresso e o erro de cada um. Confere
 * a posse da tarefa, o tamanho e o tipo pelo conteúdo, e guarda o ficheiro no Camunda; o browser só recebe a referência.
 */
export async function carregarFolha(key: string, dados: FormData): Promise<Result<ReferenciaDocumento>> {
  return protegido(async () => {
    const campo = await tarefaDeFolhas(key);
    if (!campo.ok) return campo;
    const ficheiro = dados.get('file');
    if (!(ficheiro instanceof File)) return fail('Não chegou nenhum ficheiro.');
    const problema = problemaDasFolhas(ficheiro);
    if (problema) return fail(problema);
    const bytes = new Uint8Array(await ficheiro.arrayBuffer());
    const tipo = tipoPeloConteudo(bytes);
    if (!tipo) return fail(`«${ficheiro.name}» não é uma imagem PNG, JPG nem um PDF válido.`);
    return ok(await carregarDocumento({ nome: ficheiro.name, tipo, bytes }));
  });
}

/** Passo 2: conclui «Digitalizar as folhas» com as referências dos ficheiros já carregados. */
export async function concluirComFolhas(key: string, referencias: unknown): Promise<Result<undefined>> {
  return protegido(async () => {
    const campo = await tarefaDeFolhas(key);
    if (!campo.ok) return campo;
    const recebidas = referenciasRecebidas(referencias);
    if (!recebidas.ok) return fail(recebidas.erro);
    try {
      await concluirTarefa(key, variaveisDeConclusao(campo.data, recebidas.referencias));
    } catch (e) {
      // Um segundo envio (duplo clique, outro separador) chega depois de a tarefa estar concluída.
      if (e instanceof CamundaErro && (e.estado === 404 || e.estado === 409)) return fail('Esta tarefa já foi concluída.');
      throw e;
    }
    return ok(undefined);
  });
}
