'use server';

// Tarefas do SchoolOps do professor: pautas, correcções e reclamações. O processo corre no Camunda; aqui o professor vê
// as suas tarefas e conclui-as com o form do próprio processo, no desenho do Kixi.

import { getCurrentUser } from '@/lib/auth.server';
import { fail, guard, ok, type Result } from '@/lib/crud/http';
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

/** Só professores e administradores chegam ao gestor; a conta do professor é o assignee das suas tarefas. */
async function professor(): Promise<number> {
  const user = await getCurrentUser();
  if (!user || !(user.roles.includes('TEACHER') || user.roles.includes('ADMIN'))) throw new Error('Não autenticado');
  return user.accountId;
}

export async function listarTarefas(): Promise<Result<Tarefa[]>> {
  return guard(async () => ok((await tarefasDoProfessor(await professor())).map(paraTarefa)));
}

export async function abrirTarefa(key: string): Promise<Result<TarefaAberta>> {
  return guard(async () => {
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
  return guard(async () => {
    const conta = await professor();
    const t = await obterTarefa(key);
    if (!pertenceA(t, conta)) return fail('Tarefa não encontrada ou já concluída.');
    const formulario = await obterFormulario(key);
    if (!formulario) return fail('Esta tarefa não tem formulário.');
    if (temEnvioDeFicheiros(formulario.schema)) return fail('Esta tarefa pede ficheiros: conclua-a no Tasklist.');
    // Só se devolvem as variáveis que o form escreve: o professor não consegue alterar as outras do processo.
    await concluirTarefa(key, dadosParaConcluir(dados, formulario.schema));
    return ok(undefined);
  });
}
