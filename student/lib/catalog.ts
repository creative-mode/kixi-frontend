import 'server-only';

import { apiGet } from './api';

/** A row as the backend returns it. Both shapes are tolerated because the
 *  dedicated catalog endpoint (BE-108) is still open: until it lands we read
 *  `/statements/catalog` first and fall back to plain `/statements`. */
export interface CatalogStatement {
  id: number | string;
  title: string;
  examType?: string | null;
  subject?: string | { id?: number; name?: string | null } | null;
  subjectId?: number | null;
  schoolYear?: string | { id?: number; startYear?: number; endYear?: number } | null;
  schoolYearId?: number | null;
  institution?: string | { id?: number; name?: string | null } | null;
  institutionId?: number | null;
}

export interface CatalogSimulation {
  statementId?: number | null;
  statement?: { id?: number | null } | null;
  status?: string | null;
  finalScore?: number | null;
  totalQuestions?: number | null;
  answeredQuestions?: number | null;
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
  done?: number;
  total?: number;
  score?: string;
}

export interface CatalogFilters {
  q?: string;
  subject?: string;
  examType?: string;
  year?: string;
  school?: string;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function nameOf(value: CatalogStatement['subject']): string {
  if (!value) return '';
  return typeof value === 'string' ? value : (value.name ?? '');
}

function institutionOf(value: CatalogStatement['institution']): string {
  if (!value) return '';
  return typeof value === 'string' ? value : (value.name ?? '');
}

function yearOf(statement: CatalogStatement): string {
  const { schoolYear } = statement;
  if (!schoolYear) return '';
  if (typeof schoolYear === 'string') return schoolYear;
  if (schoolYear.startYear && schoolYear.endYear) return `${schoolYear.startYear}–${schoolYear.endYear}`;
  return '';
}

function stateOf(statement: CatalogStatement, simulations: Map<number, CatalogSimulation>): {
  state: ExamState;
  done?: number;
  total?: number;
  score?: string;
} {
  const id = Number(statement.id);
  const sim = simulations.get(id);
  if (!sim) return { state: 'new' };
  const status = (sim.status ?? '').toUpperCase();
  if (status.includes('COMPLET') || status.includes('FINISH') || status.includes('GRADED')) {
    return {
      state: 'done',
      score: sim.finalScore == null ? undefined : String(sim.finalScore).replace('.', ','),
    };
  }
  return {
    state: 'progress',
    done: sim.answeredQuestions ?? undefined,
    total: sim.totalQuestions ?? undefined,
  };
}

function matches(item: CatalogItem, filters: CatalogFilters): boolean {
  if (filters.subject && item.subject !== filters.subject) return false;
  if (filters.examType && item.kind !== filters.examType) return false;
  if (filters.year && item.year !== filters.year) return false;
  if (filters.school && item.school !== filters.school) return false;
  if (filters.q) {
    const hay = `${item.title} ${item.school} ${item.year} ${item.subject}`.toLowerCase();
    if (!hay.includes(filters.q.toLowerCase())) return false;
  }
  return true;
}

/** Real catalog with graceful degradation: dedicated endpoint first, plain
 *  statements list as fallback. Never throws and never touches mock data. */
export async function getCatalog(filters: CatalogFilters): Promise<
  { ok: true; items: CatalogItem[] } | { ok: false; status: number; message: string }
> {
  const query = {
    q: filters.q || undefined,
    subject: filters.subject || undefined,
    examType: filters.examType || undefined,
  };
  let statements = await apiGet<CatalogStatement[] | { items?: CatalogStatement[]; content?: CatalogStatement[] }>(
    '/statements/catalog',
    query,
  );
  if (!statements.ok) {
    const fallback = await apiGet<CatalogStatement[]>('/statements');
    if (!fallback.ok) return fallback;
    statements = fallback;
  }

  const raw = Array.isArray(statements.data)
    ? statements.data
    : (statements.data.items ?? statements.data.content ?? []);
  const simulations = await apiGet<CatalogSimulation[]>('/simulations');
  const sims = new Map<number, CatalogSimulation>();
  if (simulations.ok && Array.isArray(simulations.data)) {
    for (const sim of simulations.data) {
      const id = Number(sim.statementId ?? sim.statement?.id);
      if (Number.isInteger(id)) sims.set(id, sim);
    }
  }

  const items = raw.map((s) => {
    const state = stateOf(s, sims);
    return {
      id: String(s.id),
      kind: text(s.examType) || 'Prova',
      title: text(s.title) || 'Sem título',
      subject: nameOf(s.subject),
      school: institutionOf(s.institution),
      year: yearOf(s),
      ...state,
    } satisfies CatalogItem;
  });

  return { ok: true, items: items.filter((item) => matches(item, filters)) };
}
