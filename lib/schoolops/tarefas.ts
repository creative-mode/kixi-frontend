// Tarefas do SchoolOps (pautas e correcções) no gestor do Kixi. As regras que não dependem do Camunda ficam aqui, com
// testes em `tarefas.test.ts`; o acesso ao Camunda está em `camunda.ts` (só no servidor).

export type Tarefa = {
  key: string;
  nome: string;
  elemento: string;
  processo: string;
  criadaEm: string;
  prazo: string | null;
};

/** Como o Camunda devolve uma tarefa na pesquisa (`POST /v2/user-tasks/search`); só os campos que o ecrã usa. */
export type TarefaCamunda = {
  userTaskKey: string;
  name?: string;
  elementId: string;
  processDefinitionId: string;
  assignee?: string | null;
  state: string;
  creationDate: string;
  dueDate?: string | null;
};

/** Nomes por processo, em linguagem do professor. O nome do elemento no BPMN é o que o Camunda diz, mas o processo não. */
const PROCESSOS: Record<string, string> = {
  'pauta-trimestral': 'Pauta do trimestre',
  'minipauta-prova': 'Prova',
  'minipauta-mac': 'Avaliação contínua',
  'correcao-prova': 'Correcção de prova',
  'correcao-simulacao': 'Correcção de simulação',
  'reclamacao-nota': 'Reclamação de nota',
};

export const nomeDoProcesso = (id: string) => PROCESSOS[id] ?? id;

export function paraTarefa(t: TarefaCamunda): Tarefa {
  return {
    key: t.userTaskKey,
    nome: t.name?.trim() || t.elementId,
    elemento: t.elementId,
    processo: nomeDoProcesso(t.processDefinitionId),
    criadaEm: t.creationDate,
    prazo: t.dueDate ?? null,
  };
}

/**
 * O professor só vê e conclui as tarefas que lhe estão atribuídas. O SchoolOps atribui ao `sourcedId` que o Kixi enviou
 * no pedido, que é o id da conta do professor.
 */
export const pertenceA = (t: Pick<TarefaCamunda, 'assignee' | 'state'>, accountId: number) =>
  t.state === 'CREATED' && t.assignee === String(accountId);

export type Componente = { type?: string; components?: Componente[]; [k: string]: unknown };

/** O schema de um form tem componentes dentro de componentes (grupos, listas): percorre-se tudo. */
export function componentesDe(schema: Componente): Componente[] {
  const todos: Componente[] = [];
  const visitar = (c: Componente) => {
    todos.push(c);
    c.components?.forEach(visitar);
  };
  schema.components?.forEach(visitar);
  return todos;
}

/** O envio de ficheiros (digitalização das folhas) ainda é feito no Tasklist: precisa de documentos do Camunda. */
export const temEnvioDeFicheiros = (schema: Componente) => componentesDe(schema).some((c) => c.type === 'filepicker');

/** O Camunda devolve cada variável como texto JSON; o form precisa dos valores. Uma variável truncada fica de fora. */
export function valoresDasVariaveis(variaveis: { name: string; value: string; isTruncated?: boolean }[]): Record<string, unknown> {
  const valores: Record<string, unknown> = {};
  for (const v of variaveis) {
    if (v.isTruncated) continue;
    try {
      valores[v.name] = JSON.parse(v.value);
    } catch {
      valores[v.name] = v.value;
    }
  }
  return valores;
}

/** Os campos que o form escreve (chaves dos componentes de entrada) são as variáveis que se devolvem ao concluir. */
export function dadosParaConcluir(dados: Record<string, unknown>, schema: Componente): Record<string, unknown> {
  const chaves = new Set(componentesDe(schema).map((c) => c.key).filter((k): k is string => typeof k === 'string'));
  return Object.fromEntries(Object.entries(dados).filter(([k]) => chaves.has(k)));
}
