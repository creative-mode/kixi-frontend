'use server';

import { getAuthHeaders } from '@/lib/auth';
import { API_BASE } from '@/lib/constants';
import type {
  ActivityPoint,
  ClassStats,
  Dashboard,
  InstitutionStats,
  Overview,
  QuestionStats,
  Section,
  StatementStats,
} from '@/types/analytics';

const BASE = `${API_BASE}/analytics`;

async function get<T>(path: string): Promise<T> {
  const headers = await getAuthHeaders();
  // Dashboards must never be served from a cache: the numbers change as students finish simulations.
  const res = await fetch(`${BASE}${path}`, { headers, cache: 'no-store' });

  if (!res.ok) {
    if (res.status === 401) throw new Error('Sessão expirada. Inicie sessão novamente.');
    if (res.status === 403) throw new Error('Sem permissão para ver estes dados.');
    if (res.status === 404) throw new Error('Não encontrado.');
    throw new Error(`Erro ${res.status} ao carregar os dados.`);
  }
  return (await res.json()) as T;
}

async function section<T>(path: string): Promise<Section<T>> {
  try {
    return { ok: true, data: await get<T>(path) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Não foi possível carregar.' };
  }
}

/**
 * Everything the dashboard shows, fetched in parallel. Each section reports
 * its own failure so that, say, a slow institutions query does not hide the
 * headline numbers.
 */
export async function getDashboard(days: number): Promise<Dashboard> {
  const [overview, activity, institutions, classes, statements] = await Promise.all([
    section<Overview>('/overview'),
    section<ActivityPoint[]>(`/activity?days=${days}`),
    section<InstitutionStats[]>('/institutions'),
    section<ClassStats[]>('/classes'),
    section<StatementStats[]>('/statements?limit=50'),
  ]);
  return { overview, activity, institutions, classes, statements, loadedAt: new Date().toISOString() };
}

export async function getStatementQuestions(statementId: number): Promise<Section<QuestionStats[]>> {
  return section<QuestionStats[]>(`/statements/${statementId}/questions`);
}
