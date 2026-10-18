import 'server-only';

import { apiGet, viewerKey } from './api';
import { TtlCache } from './ttl-cache';
import { currentAttempt, formatScore, isFinished, type Attempt } from './attempt-history';

/** Item do catálogo como o backend devolve (StatementSummary): só ids, sem nomes.
 *  Os nomes vêm de /subjects, /school-years e /institutions, carregados uma vez. */
export interface CatalogStatement {
  id: number;
  title: string;
  examType?: string | null;
  subjectId?: number | null;
  schoolYearId?: number | null;
  institutionId?: number | null;
  classId?: number | null;
}

export interface CatalogPage {
  content: CatalogStatement[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface CatalogSimulation {
  id: number;
  statement?: { id?: number | null } | null;
  status?: string | null;
  finalScore?: number | null;
}

export type ExamState = 'progress' | 'done' | 'new';

export interface CatalogItem {
  id: string;
  kind: string;
  title: string;
  subject: string;
  school: string;
  year: string;
  state: ExamState;
  score?: string;
}

export interface CatalogFilters {
  q?: string;
  subjectId?: number | null;
  examType?: string;
  schoolYearId?: number | null;
  institutionId?: number | null;
  page?: number;
  size?: number;
}

export interface Named {
  id: number;
  name: string;
}

interface SchoolYear {
  id: number;
  startYear: number;
  endYear: number;
}

function yearLabel(year: SchoolYear): string {
  return `${year.startYear}–${year.endYear}`;
}

/** Nomes para os ids do catálogo, cada endpoint carregado uma vez. */
type CatalogNames = {
  subjects: Named[];
  years: (Named & { label: string })[];
  schools: Named[];
};

/** Disciplinas, anos lectivos e escolas quase nunca mudam e eram pedidos em cada navegação (3 a 6 chamadas por página).
 *  Guardam-se 5 minutos por utilizador, e só quando as três leituras correram bem. */
const namesCache = new TtlCache<CatalogNames>(5 * 60_000, 500);

export async function getCatalogNames(): Promise<CatalogNames> {
  const viewer = await viewerKey();
  // Cada chamador recebe a sua cópia: a cache é partilhada entre pedidos e quem ordena no sítio não a estraga.
  return structuredClone(await namesCache.remember(viewer, async () => {
    const [subjects, years, schools] = await Promise.all([
      apiGet<{ id: number; name: string }[]>('/subjects'),
      apiGet<SchoolYear[]>('/school-years'),
      apiGet<{ id: number; name: string }[]>('/institutions'),
    ]);
    const value: CatalogNames = {
      subjects: subjects.ok && Array.isArray(subjects.data)
        ? subjects.data.map((s) => ({ id: s.id, name: s.name }))
        : [],
      years: years.ok && Array.isArray(years.data)
        ? years.data.map((y) => ({ id: y.id, name: `${y.startYear}–${y.endYear}`, label: yearLabel(y) }))
        : [],
      schools: schools.ok && Array.isArray(schools.data)
        ? schools.data.map((s) => ({ id: s.id, name: s.name }))
        : [],
    };
    return { value, keep: subjects.ok && years.ok && schools.ok };
  }));
}

/** Catálogo real, paginado no backend. Sem fallback: se o catálogo falhar,
 *  a página mostra erro em vez de uma lista que parece certa e não é a do aluno. */
export async function getCatalog(
  filters: CatalogFilters,
  names: { subjects: Named[]; years: (Named & { label: string })[]; schools: Named[] },
): Promise<
  | { ok: true; items: CatalogItem[]; page: number; totalPages: number; totalElements: number }
  | { ok: false; status: number; message: string }
> {
  const size = filters.size ?? 10;
  const result = await apiGet<CatalogPage>('/statements/catalog', {
    q: filters.q || undefined,
    subjectId: filters.subjectId ?? undefined,
    examType: filters.examType || undefined,
    schoolYearId: filters.schoolYearId ?? undefined,
    institutionId: filters.institutionId ?? undefined,
    page: filters.page ?? 0,
    size,
  });
  if (!result.ok) return result;

  const subjectById = new Map(names.subjects.map((s) => [s.id, s.name]));
  const yearById = new Map(names.years.map((y) => [y.id, y.label]));
  const schoolById = new Map(names.schools.map((s) => [s.id, s.name]));

  const simulations = await apiGet<CatalogSimulation[]>('/simulations');
  const attempts = new Map<number, CatalogSimulation[]>();
  if (simulations.ok && Array.isArray(simulations.data)) {
    for (const sim of simulations.data) {
      const id = Number(sim.statement?.id);
      if (!Number.isInteger(id)) continue;
      const list = attempts.get(id) ?? [];
      list.push(sim);
      attempts.set(id, list);
    }
  }

  const items = (result.data.content ?? []).map((s) => {
    // `currentAttempt` vem de `attempt-history.ts`, o mesmo módulo que o detalhe (#19)
    // usa. Estava reimplementado aqui e as duas cópias já discordavam numa tentativa
    // CANCELLED: o cartão dizia «Ver resultado» e o detalhe «Em curso». Uma regra só.
    const attempt = currentAttempt((attempts.get(Number(s.id)) ?? []) as Attempt[]);
    const finished = attempt ? isFinished(attempt) : false;
    return {
      id: String(s.id),
      kind: s.examType || 'Prova',
      title: s.title || 'Sem título',
      subject: s.subjectId == null ? '' : (subjectById.get(s.subjectId) ?? ''),
      school: s.institutionId == null ? '' : (schoolById.get(s.institutionId) ?? ''),
      year: s.schoolYearId == null ? '' : (yearById.get(s.schoolYearId) ?? ''),
      state: !attempt ? 'new' : finished ? 'done' : 'progress',
      score: finished ? formatScore(attempt?.finalScore) : undefined,
    } satisfies CatalogItem;
  });

  return {
    ok: true,
    items,
    page: result.data.page,
    totalPages: result.data.totalPages,
    totalElements: result.data.totalElements,
  };
}
