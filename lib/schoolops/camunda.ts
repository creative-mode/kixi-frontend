import 'server-only';
import type { Componente, TarefaCamunda } from './tarefas';
import { FonteDeToken, configuracaoDoAmbiente } from './token';

// Acesso do gestor ao Camunda (API REST v2) para as tarefas do SchoolOps. Só corre no servidor: o browser nunca fala com o
// Camunda, e o token do Camunda nunca chega ao browser. Quem decide de quem é a tarefa é o `assignee`, e a verificação
// faz-se em `app/actions/schoolops.ts` antes de qualquer leitura ou conclusão.

export class CamundaErro extends Error {
  constructor(readonly estado: number, corpo: string) {
    super(`Camunda ${estado}: ${corpo.slice(0, 200)}`);
  }
}

function base(): string {
  const url = process.env.SCHOOLOPS_CAMUNDA_URL;
  if (!url) throw new Error('As tarefas do SchoolOps não estão configuradas (SCHOOLOPS_CAMUNDA_URL).');
  return `${url.replace(/\/$/, '')}/v2`;
}

// Com SCHOOLOPS_CAMUNDA_TOKEN_URL, _CLIENT_ID e _CLIENT_SECRET o token vem do Keycloak por client credentials; senão
// vale o token estático (ou nenhum, com o Camunda aberto).
let fonte: FonteDeToken | null | undefined;
function fonteDeToken(): FonteDeToken | null {
  if (fonte === undefined) {
    const cfg = configuracaoDoAmbiente(process.env);
    fonte = cfg ? new FonteDeToken(cfg) : null;
  }
  return fonte;
}

async function pedir<T>(caminho: string, init: RequestInit = {}): Promise<T> {
  const origem = fonteDeToken();
  for (let tentativa = 0; ; tentativa++) {
    const token = origem ? await origem.obter() : process.env.SCHOOLOPS_CAMUNDA_TOKEN;
    const res = await fetch(`${base()}${caminho}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init.headers as Record<string, string> | undefined),
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    });
    if (res.status === 401 && origem && tentativa === 0) {
      origem.invalidar(); // o token pode ter sido revogado ou o relógio ter derivado: pede-se outro e repete-se uma vez
      continue;
    }
    if (!res.ok) {
      const corpo = await res.text().catch(() => '');
      throw new CamundaErro(res.status, corpo);
    }
    return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
  }
}

const LIMITE_TAREFAS = 100;

export async function tarefasDoProfessor(accountId: number): Promise<{ items: TarefaCamunda[]; total: number }> {
  const r = await pedir<{ items: TarefaCamunda[]; page: { totalItems: number } }>('/user-tasks/search', {
    method: 'POST',
    body: JSON.stringify({
      filter: { assignee: String(accountId), state: 'CREATED' },
      // as mais antigas primeiro: são as que estão mais atrasadas
      sort: [{ field: 'creationDate', order: 'ASC' }],
      page: { limit: LIMITE_TAREFAS },
    }),
  });
  return { items: r.items, total: r.page?.totalItems ?? r.items.length };
}

export const obterTarefa = (key: string) => pedir<TarefaCamunda>(`/user-tasks/${encodeURIComponent(key)}`);

/** O schema do form vem como texto JSON. */
export async function obterFormulario(key: string): Promise<{ formId: string; schema: Componente } | null> {
  try {
    const f = await pedir<{ formId: string; schema: string }>(`/user-tasks/${encodeURIComponent(key)}/form`);
    try {
      return { formId: f.formId, schema: JSON.parse(f.schema) as Componente };
    } catch {
      throw new Error('O formulário da tarefa não é JSON válido.');
    }
  } catch (e) {
    if (e instanceof CamundaErro && e.estado === 404) return null; // tarefa sem form
    throw e;
  }
}

type VariavelCamunda = { name: string; value: string; isTruncated?: boolean; variableKey?: string };

/** Todas as variáveis da tarefa, página a página, com o valor completo das que o Camunda trunca. */
export async function variaveisDaTarefa(key: string): Promise<{ name: string; value: string }[]> {
  const todas: VariavelCamunda[] = [];
  let depois: string | undefined;
  for (let pagina = 0; pagina < 10; pagina++) {
    const r = await pedir<{ items: VariavelCamunda[]; page: { endCursor?: string } }>(
      `/user-tasks/${encodeURIComponent(key)}/variables/search`,
      { method: 'POST', body: JSON.stringify({ page: { limit: 200, ...(depois ? { after: depois } : {}) } }) },
    );
    todas.push(...r.items);
    if (r.items.length < 200 || !r.page?.endCursor) break;
    depois = r.page.endCursor;
  }
  return Promise.all(
    todas.map(async (v) => {
      if (!v.isTruncated || !v.variableKey) return { name: v.name, value: v.value };
      const inteira = await pedir<{ value: string }>(`/variables/${encodeURIComponent(v.variableKey)}`);
      return { name: v.name, value: inteira.value };
    }),
  );
}

export const concluirTarefa = (key: string, variables: Record<string, unknown>) =>
  pedir<void>(`/user-tasks/${encodeURIComponent(key)}/completion`, { method: 'POST', body: JSON.stringify({ variables }) });
