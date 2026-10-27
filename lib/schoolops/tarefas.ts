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

/** Componentes que só mostram: nunca escrevem variáveis. */
const SO_MOSTRAM = new Set(['text', 'html', 'image', 'button', 'expression', 'spacer', 'separator', 'table', 'iframe', 'documentPreview']);

/**
 * O nome com que um componente se liga aos dados do form. Os campos de entrada usam `key`; as listas dinâmicas e os grupos
 * com caminho usam `path` (é o que os forms do SchoolOps têm: nenhuma lista dinâmica tem `key`). Um nome com pontos
 * (`a.b`) guarda-se dentro da variável `a`.
 */
export function nomeDoCampo(c: Componente): string | null {
  if (typeof c.key === 'string' && c.key) return c.key;
  if (typeof c.path === 'string' && c.path) return c.path;
  return null;
}

/** A variável do processo a que o nome pertence: o primeiro segmento. */
export const variavelDe = (nome: string) => nome.split('.')[0];

/**
 * Os campos que o professor pode escrever: componentes de entrada, listas dinâmicas e grupos com caminho, ao nível do
 * form (um grupo sem caminho só agrupa: entra-se nele). Nem só de leitura, nem desactivados, nem calculados. Os filhos de uma
 * lista não são variáveis do processo, vão dentro da lista.
 */
export function camposEscreviveis(schema: Componente): Componente[] {
  const campos: Componente[] = [];
  const visitar = (c: Componente) => {
    if (c.type === 'group' && nomeDoCampo(c) === null) {
      c.components?.forEach(visitar);
      return;
    }
    if (SO_MOSTRAM.has(String(c.type)) || c.readonly === true || c.disabled === true || nomeDoCampo(c) === null) return;
    campos.push(c);
  };
  schema.components?.forEach(visitar);
  return campos;
}

/** O que se devolve ao concluir: só as variáveis dos campos escreviveis. */
export function dadosParaConcluir(dados: Record<string, unknown>, schema: Componente): Record<string, unknown> {
  const variaveis = new Set(camposEscreviveis(schema).map((c) => variavelDe(nomeDoCampo(c) as string)));
  return Object.fromEntries(Object.entries(dados).filter(([k]) => variaveis.has(k)));
}

const vazio = (v: unknown, tipo?: string) =>
  v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0) || (tipo === 'checkbox' && v === false);

/** O valor num caminho com pontos (`a.b`). */
const valorEm = (dados: Record<string, unknown>, nome: string): unknown =>
  nome.split('.').reduce<unknown>((acc, parte) => (acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[parte] : undefined), dados);

/**
 * O servidor também confere as regras `required`: o browser valida, mas a acção pode ser chamada sem ele.
 * @returns a mensagem do primeiro campo em falta, ou null
 */
export function primeiroErro(dados: Record<string, unknown>, schema: Componente): string | null {
  for (const c of camposEscreviveis(schema)) {
    const validate = c.validate as { required?: boolean } | undefined;
    const nome = nomeDoCampo(c) as string;
    if (validate?.required && vazio(valorEm(dados, nome), c.type)) {
      return `O campo "${String(c.label ?? nome)}" é obrigatório.`;
    }
  }
  return null;
}
