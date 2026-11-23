// Tarefas do SchoolOps (pautas e correcções) no gestor do Kixi. As regras que não dependem do Camunda ficam aqui, com
// testes em `tarefas.test.ts`; o acesso ao Camunda está em `camunda.ts` (só no servidor).

export type Tarefa = {
  key: string;
  nome: string;
  elemento: string;
  processo: string;
  criadaEm: string;
  prazo: string | null;
  /** A que prova (P1/P2), avaliação contínua ou turma/disciplina a tarefa se refere (kixi-frontend#774); `null` quando
   *  as variáveis ainda não chegaram ou o processo não é dos que o ecrã sabe descrever. */
  detalhe: string | null;
};

/** Como o Camunda devolve uma tarefa na pesquisa (`POST /v2/user-tasks/search`); só os campos que o ecrã usa. */
export type TarefaCamunda = {
  userTaskKey: string;
  name?: string;
  elementId: string;
  processDefinitionId: string;
  /** A instância do processo a que a tarefa pertence; é por aqui que se juntam as variáveis (kixi-frontend#774). */
  processInstanceKey: string;
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

/** Os nomes das variáveis que o ecrã lê para descrever a tarefa (kixi-frontend#774): a prova, a avaliação contínua, a
 *  turma/disciplina da pauta e o tipo de prova. Usado para pedir só estas ao Camunda, numa só pesquisa para todas as
 *  tarefas da lista. `tipoProva` (kixi-frontend#809) é como se reconhece uma avaliação de MAC em `minipauta-prova` e
 *  `correcao-prova` (o mesmo processo da P1/P2, desde o schoolops#65): vale `AVALIACAO_CONTINUA`, nunca um objecto. */
export const NOMES_DAS_VARIAVEIS_DO_CARTAO = ['provaId', 'prova', 'avaliacaoContinua', 'pauta', 'tipoProva', 'componentes'];

const texto = (v: unknown): string | undefined => {
  if (typeof v === 'string') return v.trim() || undefined;
  if (typeof v === 'number') return String(v);
  return undefined;
};

/**
 * A turma e a disciplina da pauta a que a tarefa pertence (kixi-frontend#774), quando a variável `pauta` as tiver.
 * Comum a toda a família de tarefas da pauta (prova, MAC, correcção, reclamação), por isso não depende do processo.
 */
function turmaEDisciplina(variaveis: Record<string, unknown>): string | undefined {
  const pauta = variaveis.pauta as { turma?: unknown; disciplina?: unknown } | undefined;
  const turma = texto(pauta?.turma);
  const disciplina = texto(pauta?.disciplina);
  if (disciplina && turma) return `${disciplina} · ${turma}`;
  return disciplina ?? turma;
}

/**
 * Se a prova da tarefa é a P1 ou a P2 (V2-10): a instância de `correcao-prova` não traz o componente na variável `prova`,
 * mas traz `componentes` (`npp` = P1, `npt` = P2, cada uma com o `provaId`) e o `provaId` da própria tarefa. Compara-se um com
 * os outros; uma prova que não é de nenhuma componente (ou uma avaliação de MAC) não se inventa como P1 nem P2.
 */
export function componenteDaProva(variaveis: Record<string, unknown>): 'P1' | 'P2' | null {
  if (variaveis.tipoProva === 'AVALIACAO_CONTINUA') return null;
  const id = texto(variaveis.provaId);
  const c = variaveis.componentes;
  if (!id || !c || typeof c !== 'object') return null;
  const { npp, npt } = c as { npp?: { provaId?: unknown } | null; npt?: { provaId?: unknown } | null };
  if (texto(npp?.provaId) === id) return 'P1';
  if (texto(npt?.provaId) === id) return 'P2';
  return null;
}

/**
 * A que prova ou avaliação contínua a tarefa se refere (kixi-frontend#774): o título quando o motor o tiver, ou
 * "Prova P1"/"Prova P2" a partir do componente (é o que `SchoolOpsPautaOpener`, no backend, sempre manda; o motor não
 * recebe um título de texto para a prova), seguido da turma/disciplina. `null` quando nada identifica a tarefa.
 *
 * Uma avaliação de MAC com enunciado corre o mesmo processo da P1/P2 (`minipauta-prova`, que chama `correcao-prova`;
 * schoolops#65/kixi-frontend#809), com `tipoProva = AVALIACAO_CONTINUA`: reconhece-se por esta variável, não pelo
 * `processDefinitionId` (que é o da prova). O motor não traz o título da avaliação como variável leve da tarefa (só o
 * `pedido` inteiro, grande demais para aqui); `tituloAvaliacao`, quando o chamador o resolveu (o enunciado no Kixi, pelo
 * `provaId`), entra no texto. Sem ele mostra-se "Avaliação contínua" liso — melhor do que nada, nunca "Prova P1".
 */
export function tituloDaTarefa(processDefinitionId: string, variaveis: Record<string, unknown>, tituloAvaliacao?: string | null): string | null {
  const contexto = turmaEDisciplina(variaveis);
  if (variaveis.tipoProva === 'AVALIACAO_CONTINUA') {
    const referencia = tituloAvaliacao ? `Avaliação contínua: ${tituloAvaliacao}` : 'Avaliação contínua';
    return [referencia, contexto].filter(Boolean).join(' · ') || null;
  }
  if (processDefinitionId === 'minipauta-prova') {
    const prova = variaveis.prova as { componente?: unknown; titulo?: unknown } | string | undefined;
    const titulo = typeof prova === 'string' ? texto(prova) : texto(prova?.titulo);
    const componente = typeof prova === 'object' ? texto(prova?.componente) : undefined;
    const idSolto = texto(variaveis.provaId);
    const referencia = titulo ?? (componente ? `Prova ${componente}` : undefined) ?? (componenteDaProva(variaveis) ? `Prova ${componenteDaProva(variaveis)}` : undefined) ?? (idSolto ? `Prova ${idSolto}` : undefined);
    return [referencia, contexto].filter(Boolean).join(' · ') || null;
  }
  if (processDefinitionId === 'minipauta-mac') {
    const avaliacao = variaveis.avaliacaoContinua as { titulo?: unknown } | string | undefined;
    const titulo = typeof avaliacao === 'string' ? texto(avaliacao) : texto(avaliacao?.titulo);
    return [titulo, contexto].filter(Boolean).join(' · ') || null;
  }
  // `correcao-prova` (recolher, digitalizar, tratar leituras): diz se é a P1 ou a P2, que de outro modo têm o mesmo título (V2-10).
  const componente = componenteDaProva(variaveis);
  if (componente) return [`Prova ${componente}`, contexto].filter(Boolean).join(' · ');
  return contexto ?? null;
}

export function paraTarefa(t: TarefaCamunda, variaveis: Record<string, unknown> = {}, tituloAvaliacao?: string | null): Tarefa {
  return {
    key: t.userTaskKey,
    nome: t.name?.trim() || t.elementId,
    elemento: t.elementId,
    processo: nomeDoProcesso(t.processDefinitionId),
    criadaEm: t.creationDate,
    prazo: t.dueDate ?? null,
    detalhe: tituloDaTarefa(t.processDefinitionId, variaveis, tituloAvaliacao),
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
