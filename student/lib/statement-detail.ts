import 'server-only';

import { apiGet } from './api';
import { getCatalogNames, type Named } from './catalog';
import { currentAttempt, history, sinceLabel, type Attempt } from './attempt-history';

/** What `GET /statements/{id}` answers: a StatementSummary. No questions, no options,
 *  and no answer key — `StatementOcrResponse.from` withholds `isCorrect` from anyone
 *  who may not edit the statement. */
export interface StatementDetail {
  id: number;
  title: string;
  examType?: string | null;
  durationMinutes?: number | null;
  totalMaxScore?: number | null;
  variant?: string | null;
  subjectId?: number | null;
  schoolYearId?: number | null;
  institutionId?: number | null;
}

/** The summary the screen shows: ids resolved to names, the way the catalog card does. */
export interface StatementSummaryView {
  id: number;
  title: string;
  kind: string;
  subject: string;
  school: string;
  year: string;
  durationMinutes?: number;
  totalMaxScore?: number;
}

export interface AttemptRow {
  id: number;
  finished: boolean;
  score?: string;
  since?: string;
}

export type StatementDetailResult =
  | { kind: 'ok'; summary: StatementSummaryView; attempts: AttemptRow[]; current: AttemptRow | null }
  /** The statement is not there, or not visible to this student. The backend answers
   *  404 for both, and the difference is not the student's business. */
  | { kind: 'missing' }
  /** The session is gone: only the login can fix this. */
  | { kind: 'unauthorized' }
  /** Anything else — a dead network, a 500. Degrade, never block. */
  | { kind: 'unknown'; message: string };

const nameOf = (list: Named[], id: number | null | undefined) =>
  id == null ? '' : (list.find((n) => n.id === id)?.name ?? '');

function toRow(attempt: Attempt): AttemptRow {
  const finished = (attempt.status ?? '').toUpperCase() === 'FINISHED';
  return {
    id: attempt.id,
    finished,
    // Uma nota de zero é uma nota: só a ausente é ausente.
    score: finished && attempt.finalScore != null ? String(attempt.finalScore).replace('.', ',') : undefined,
    since: sinceLabel(attempt.startedAt),
  };
}

/**
 * The statement behind the detail screen: its summary and this student's attempts.
 *
 * The question count is deliberately absent. Neither `StatementSummary` nor the
 * catalog carries one — it is being added upstream in kixi#178 — and `/statements/{id}/full`
 * would bring the whole paper to count a number, which is the wrong trade for a screen
 * whose whole job is deciding whether to start it.
 */
export async function getStatementDetail(id: number): Promise<StatementDetailResult> {
  if (!Number.isInteger(id) || id <= 0) return { kind: 'missing' };

  const [statement, simulations, names] = await Promise.all([
    apiGet<StatementDetail>(`/statements/${id}`),
    apiGet<(Attempt & { statement?: { id?: number | null } | null })[]>('/simulations'),
    getCatalogNames(),
  ]);

  if (!statement.ok) {
    if (statement.status === 401) return { kind: 'unauthorized' };
    if (statement.status === 404) return { kind: 'missing' };
    return { kind: 'unknown', message: statement.message };
  }

  const mine = simulations.ok && Array.isArray(simulations.data)
    ? simulations.data.filter((s) => Number(s.statement?.id) === id)
    : [];
  const attempts = history(mine).map(toRow);
  const current = mine.length > 0 ? toRow(currentAttempt(mine)!) : null;

  const s = statement.data;
  return {
    kind: 'ok',
    summary: {
      id: s.id,
      title: s.title || 'Sem título',
      kind: s.examType || 'Prova',
      subject: nameOf(names.subjects, s.subjectId),
      school: nameOf(names.schools, s.institutionId),
      year: nameOf(names.years, s.schoolYearId),
      durationMinutes: s.durationMinutes ?? undefined,
      totalMaxScore: s.totalMaxScore ?? undefined,
    },
    attempts,
    current,
  };
}

/**
 * Just the title, for the tutor header when it opens with `?statementId=`.
 *
 * Separate because the tutor must not die when this fails: it still works, it just
 * does not say which paper it is about.
 */
export async function getStatementTitle(id: number): Promise<string | null> {
  if (!Number.isInteger(id) || id <= 0) return null;
  const result = await apiGet<{ title?: string | null }>(`/statements/${id}`);
  return result.ok && result.data?.title ? result.data.title : null;
}
