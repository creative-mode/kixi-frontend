'use server';

import { getAuthHeaders } from '@/lib/auth.server';
import { API_BASE } from '@/lib/constants';
import type {
  ActivityPoint,
  ClassDashboard,
  ClassStudentStats,
  HardQuestion,
  WeeklyPoint,
  ClassStats,
  Dashboard,
  InstitutionStats,
  Overview,
  QuestionStats,
  Section,
  StatementStats,
} from '@/types/analytics';
import { apiFetch } from '@/lib/mock/fetch';
import { TIMEOUT_MESSAGE, isTimeout, timeoutSignal, withDeadline } from '@/lib/timeout';

const BASE = `${API_BASE}/analytics`;

async function get<T>(path: string): Promise<T> {
  const headers = await getAuthHeaders();
  // Dashboards must never be served from a cache: the numbers change as students finish simulations.
  // E nunca devem esperar para sempre: o prazo transforma um pedido pendurado
  // num erro de secção com "Tentar novamente" (#191).
  let res: Response;
  try {
    res = await withDeadline(apiFetch(`${BASE}${path}`, { headers, cache: 'no-store', signal: timeoutSignal() }));
  } catch (err) {
    if (isTimeout(err)) throw new Error(TIMEOUT_MESSAGE);
    throw err;
  }

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

/** Escola e turma: só estreitam o que o papel já deixa ver (o backend aplica o scope). */
export type DashboardFilters = { institutionId?: number | null; classId?: number | null };

function filterQuery({ institutionId, classId }: DashboardFilters): string {
  const q = new URLSearchParams();
  if (institutionId && Number.isInteger(institutionId) && institutionId > 0) q.set('institutionId', String(institutionId));
  if (classId && Number.isInteger(classId) && classId > 0) q.set('classId', String(classId));
  return q.toString();
}

/**
 * Everything the dashboard shows, fetched in parallel. Each section reports
 * its own failure so that, say, a slow institutions query does not hide the
 * headline numbers.
 */
export async function getDashboard(days: number, filters: DashboardFilters = {}): Promise<Dashboard> {
  const f = filterQuery(filters);
  const [overview, activity, institutions, classes, statements] = await Promise.all([
    section<Overview>(`/overview?${f}`),
    section<ActivityPoint[]>(`/activity?days=${Math.trunc(days)}&${f}`),
    section<InstitutionStats[]>(`/institutions?${f}`),
    section<ClassStats[]>(`/classes?${f}`),
    section<StatementStats[]>(`/statements?limit=50&${f}`),
  ]);
  return { overview, activity, institutions, classes, statements, loadedAt: new Date().toISOString() };
}

export async function getStatementQuestions(statementId: number): Promise<Section<QuestionStats[]>> {
  return section<QuestionStats[]>(`/statements/${statementId}/questions`);
}

/** O que o professor vê de uma turma: alunos, evolução por semana e as questões mais falhadas. */
export async function getClassDashboard(classId: number, weeks = 8): Promise<ClassDashboard> {
  if (!Number.isInteger(classId) || classId <= 0) {
    const error = { ok: false as const, error: 'Turma inválida.' };
    return { students: error, weekly: error, questions: error };
  }
  const [students, weekly, questions] = await Promise.all([
    section<ClassStudentStats[]>(`/classes/${classId}/students`),
    section<WeeklyPoint[]>(`/classes/${classId}/weekly?weeks=${Math.trunc(weeks)}`),
    section<HardQuestion[]>(`/classes/${classId}/questions?limit=10`),
  ]);
  return { students, weekly, questions };
}
