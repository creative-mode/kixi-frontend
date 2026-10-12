import 'server-only';

import { apiGet } from './api';
import { getCatalogNames, type Named } from './catalog';
import { currentAttempt, formatScore, history, labelOf, sinceLabel, type Attempt, type AttemptLabel } from './attempt-history';
import type { PaperQuestion } from './tutor-rules';

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
  /** 'corrected' | 'unfinished' | 'cancelled' — from `labelOf`, the same rule the card uses. */
  label: AttemptLabel;
  score?: string;
  since?: string;
}

export type StatementDetailResult =
  | { kind: 'ok'; summary: StatementSummaryView; attempts: AttemptRow[]; current: AttemptRow | null }
  /** The statement came, but the attempts did not. Distinct from 'ok' with an empty
   *  list on purpose: saying «ainda não tentaste» when the request failed is telling
   *  the student something false about their own work, and they would act on it. */
  | { kind: 'partial'; summary: StatementSummaryView; message: string }
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
  const label = labelOf(attempt);
  return {
    id: attempt.id,
    label,
    // Uma nota de zero é uma nota: só a ausente é ausente. E uma tentativa cancelada
    // nunca tem nota, porque nunca foi corrigida.
    score: label === 'corrected' ? formatScore(attempt.finalScore) : undefined,
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

  const s0 = statement.data;
  const summary: StatementSummaryView = {
    id: s0.id,
    title: s0.title || 'Sem título',
    kind: s0.examType || 'Prova',
    subject: nameOf(names.subjects, s0.subjectId),
    school: nameOf(names.schools, s0.institutionId),
    year: nameOf(names.years, s0.schoolYearId),
    durationMinutes: s0.durationMinutes ?? undefined,
    totalMaxScore: s0.totalMaxScore ?? undefined,
  };

  if (!simulations.ok) {
    return { kind: 'partial', summary, message: simulations.message };
  }

  const mine = Array.isArray(simulations.data)
    ? simulations.data.filter((x) => Number(x.statement?.id) === id)
    : [];
  return {
    kind: 'ok',
    summary,
    attempts: history(mine).map(toRow),
    current: mine.length > 0 ? toRow(currentAttempt(mine)!) : null,
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

/**
 * The paper's questions, for the tutor's "which question?" picker.
 *
 * `GET /statements/{id}/questions` withholds the answer key from a student, so this
 * carries no more than the catalog screen already shows. Like the title, a failure
 * here is not fatal: the tutor falls back to the whole paper.
 */
export async function getStatementQuestions(id: number): Promise<PaperQuestion[]> {
  if (!Number.isInteger(id) || id <= 0) return [];
  const result = await apiGet<{ id?: number; number?: number | null; text?: string | null }[]>(
    `/statements/${id}/questions`,
  );
  if (!result.ok || !Array.isArray(result.data)) return [];
  return result.data
    .filter((question) => Number.isInteger(question.id) && (question.id as number) > 0)
    .map((question) => ({
      id: question.id as number,
      number: Number.isInteger(question.number) ? (question.number as number) : 0,
      text: (question.text ?? '').trim(),
    }))
    .sort((a, b) => a.number - b.number)
    .slice(0, 50);
}
