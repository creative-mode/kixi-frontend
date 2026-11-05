import 'server-only';

import { apiGet } from './api';
import { listSimulations, type Simulation } from './exam';
import { compareWithPrevious, type Comparison, type SimulationResult } from './result-rules';

export type ResultView =
  | {
      kind: 'ok';
      result: SimulationResult;
      statementId: number | null;
      title: string;
      totalMaxScore: number | null;
      comparison: Comparison | null;
      /** Quando a tentativa começou e terminou, para saber que medalhas o servidor
       *  atribuiu durante ela (#492). */
      startedAt: string | null;
      finishedAt: string | null;
    }
  /** Still IN_PROGRESS: the server answers 409 until the proof is handed in, and the
   *  student belongs in the room. */
  | { kind: 'in-progress'; statementId: number | null }
  | { kind: 'missing' }
  | { kind: 'unauthorized' }
  | { kind: 'error'; message: string };

/** The result of one attempt, with the paper it belongs to and the previous attempt's
 *  score. The server owns every number; this only fetches. A failure of the attempts
 *  list costs the comparison, not the screen. */
export async function getResultView(simulationId: number): Promise<ResultView> {
  const [result, simulation] = await Promise.all([
    apiGet<SimulationResult>(`/simulations/${simulationId}/result`),
    apiGet<Simulation>(`/simulations/${simulationId}`),
  ]);

  const statementId = simulation.ok ? (simulation.data.statement?.id ?? null) : null;

  if (!result.ok) {
    if (result.status === 401) return { kind: 'unauthorized' };
    if (result.status === 404) return { kind: 'missing' };
    if (result.status === 409) return { kind: 'in-progress', statementId };
    return { kind: 'error', message: result.message };
  }

  const attempts = statementId == null
    ? []
    : (await listSimulations()).filter((s) => Number(s.statement?.id) === statementId);
  const finalScore = result.data.finalScore ?? null;

  return {
    kind: 'ok',
    result: result.data,
    statementId,
    title: (simulation.ok && simulation.data.statement?.title) || 'Prova',
    totalMaxScore: simulation.ok ? (simulation.data.statement?.totalMaxScore ?? null) : null,
    comparison: compareWithPrevious(
      simulationId,
      finalScore,
      attempts.map((a) => ({ id: Number(a.id), status: a.status, finalScore: a.finalScore })),
    ),
    startedAt: simulation.ok ? (simulation.data.startedAt ?? null) : null,
    finishedAt: simulation.ok ? (simulation.data.finishedAt ?? null) : null,
  };
}
