import 'server-only';

import { listSimulationsResult } from './exam';
import { marcarNotaDoMotor } from './nota-do-motor';
import { buildPerformance, type Performance } from './performance-rules';

export type { Performance } from './performance-rules';

const EMPTY: Performance = { mastery: [], activity: [] };

/** O desempenho do aluno, de `GET /simulations`. Uma falha dá um desempenho vazio: é um
 *  painel de apoio, e não deve levar a página com ele. */
export async function getPerformance(): Promise<Performance> {
  // A mesma leitura de `/simulations` que o resto da página (#791): uma só, por pedido.
  const result = await listSimulationsResult();
  if (!result.ok) return EMPTY;
  // A percentagem continua sobre a cotação; a lista do perfil esconde o número quando
  // a nota é a do motor (#820).
  return buildPerformance(await marcarNotaDoMotor(result.data));
}
