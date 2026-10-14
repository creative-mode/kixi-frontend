import 'server-only';

import { apiGet } from './api';
import { buildPerformance, type Performance, type RawSimulation } from './performance-rules';

export type { Performance } from './performance-rules';

const EMPTY: Performance = { mastery: [], activity: [] };

/** O desempenho do aluno, de `GET /simulations`. Uma falha dá um desempenho vazio: é um
 *  painel de apoio, e não deve levar a página com ele. */
export async function getPerformance(): Promise<Performance> {
  const result = await apiGet<RawSimulation[]>('/simulations');
  return result.ok && Array.isArray(result.data) ? buildPerformance(result.data) : EMPTY;
}
