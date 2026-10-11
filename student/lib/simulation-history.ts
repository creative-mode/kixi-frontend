/** The student's own simulations as the profile lists them, newest first. Pure, so
 *  `node --test` can reach it. The card, the paper's detail and this list must agree on
 *  what an attempt is, so the labels, the score format and the date come from
 *  `attempt-history.ts` and are not redone here. */
import { formatScore, labelOf, sinceLabel, type AttemptLabel } from './attempt-history.ts';
import type { SimulationSummary } from './exam-rules.ts';

export interface HistoryRow {
  id: number;
  statementId: number | null;
  title: string;
  label: AttemptLabel;
  /** Only a corrected attempt has one; zero is a score. */
  score?: string;
  since?: string;
}

export function historyRows(simulations: SimulationSummary[]): HistoryRow[] {
  // Newest first, by id: the order `history` fixes for every list of attempts.
  const newest = [...simulations].sort((a, b) => Number(b.id) - Number(a.id));
  return newest.map((s) => {
    const label = labelOf({ ...s, id: Number(s.id) });
    return {
      id: Number(s.id),
      statementId: s.statement?.id ?? null,
      title: s.statement?.title?.trim() || 'Prova',
      label,
      score: label === 'corrected' ? formatScore(s.finalScore) : undefined,
      since: sinceLabel(s.startedAt),
    };
  });
}
