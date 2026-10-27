import 'server-only';
import type { Componente, TarefaCamunda } from './tarefas';

// Acesso do gestor ao Camunda (API REST v2) para as tarefas do SchoolOps. Só corre no servidor: o browser nunca fala com o
// Camunda, e o token do Camunda nunca chega ao browser. Quem decide de quem é a tarefa é o `assignee`, e a verificação
// faz-se em `app/actions/schoolops.ts` antes de qualquer leitura ou conclusão.

function base(): string {
  const url = process.env.SCHOOLOPS_CAMUNDA_URL;
  if (!url) throw new Error('As tarefas do SchoolOps não estão configuradas (SCHOOLOPS_CAMUNDA_URL).');
  return `${url.replace(/\/$/, '')}/v2`;
}

async function pedir<T>(caminho: string, init: RequestInit = {}): Promise<T> {
  const token = process.env.SCHOOLOPS_CAMUNDA_TOKEN;
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
  if (!res.ok) {
    const corpo = await res.text().catch(() => '');
    throw new Error(`Camunda ${res.status}: ${corpo.slice(0, 200)}`);
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

export async function tarefasDoProfessor(accountId: number): Promise<TarefaCamunda[]> {
  const r = await pedir<{ items: TarefaCamunda[] }>('/user-tasks/search', {
    method: 'POST',
    body: JSON.stringify({
      filter: { assignee: String(accountId), state: 'CREATED' },
      sort: [{ field: 'creationDate', order: 'DESC' }],
      page: { limit: 100 },
    }),
  });
  return r.items;
}

export const obterTarefa = (key: string) => pedir<TarefaCamunda>(`/user-tasks/${encodeURIComponent(key)}`);

/** O schema do form vem como texto JSON. */
export async function obterFormulario(key: string): Promise<{ formId: string; schema: Componente } | null> {
  try {
    const f = await pedir<{ formId: string; schema: string }>(`/user-tasks/${encodeURIComponent(key)}/form`);
    return { formId: f.formId, schema: JSON.parse(f.schema) as Componente };
  } catch (e) {
    if (String((e as Error).message).startsWith('Camunda 404')) return null; // tarefa sem form
    throw e;
  }
}

export async function variaveisDaTarefa(key: string): Promise<{ name: string; value: string; isTruncated?: boolean }[]> {
  const r = await pedir<{ items: { name: string; value: string; isTruncated?: boolean }[] }>(
    `/user-tasks/${encodeURIComponent(key)}/variables/search`,
    { method: 'POST', body: JSON.stringify({ page: { limit: 200 } }) },
  );
  return r.items;
}

export const concluirTarefa = (key: string, variables: Record<string, unknown>) =>
  pedir<void>(`/user-tasks/${encodeURIComponent(key)}/completion`, { method: 'POST', body: JSON.stringify({ variables }) });
