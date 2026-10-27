'use server';

// Tarefas do SchoolOps do professor: pautas, correcções e reclamações. O processo corre no Camunda; aqui o professor vê
// as suas tarefas e conclui-as com o form do próprio processo, no desenho do Kixi.

import { getCurrentUser } from '@/lib/auth.server';
import { fail, ok, type Result } from '@/lib/crud/http';
import {
  concluirTarefa,
  obterFormulario,
  obterTarefa,
  tarefasDoProfessor,
  variaveisDaTarefa,
} from '@/lib/schoolops/camunda';
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
  /** O form pede ficheiros: ainda se faz no Tasklist. */
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

/** Só professores e administradores chegam ao gestor; a conta do professor é o assignee das suas tarefas. */
async function professor(): Promise<number> {
  const user = await getCurrentUser();
  if (!user || !(user.roles.includes('TEACHER') || user.roles.includes('ADMIN'))) throw new Error('Não autenticado');
  return user.accountId;
}

export type ListaDeTarefas = { tarefas: Tarefa[]; total: number };

export async function listarTarefas(): Promise<Result<ListaDeTarefas>> {
  return protegido(async () => {
    const { items, total } = await tarefasDoProfessor(await professor());
    return ok({ tarefas: items.map(paraTarefa), total });
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
    if (temEnvioDeFicheiros(formulario.schema)) return fail('Esta tarefa pede ficheiros: conclua-a no Tasklist.');
    const erro = primeiroErro(dados, formulario.schema);
    if (erro) return fail(erro);
    // Só se devolvem os campos de entrada do form (não os de leitura nem os calculados): o professor não altera as outras
    // variáveis do processo.
    await concluirTarefa(key, dadosParaConcluir(dados, formulario.schema));
    return ok(undefined);
  });
}
