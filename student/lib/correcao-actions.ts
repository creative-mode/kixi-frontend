'use server';

import { requireStudent } from './guard';
import { getMe } from './me';
import { listInvitations } from './exam-room';
import { getResultView } from './result';
import { eSimulacaoLivre } from './schoolops/correcao-rules';
import { correcaoDaSimulacao, correcaoLigada } from './schoolops/correcao';

/**
 * «Tentar de novo» do ecrã de correção (#787): volta a pedir a correção ao motor (idempotente por simulação) e diz o que
 * o motor respondeu. Quem chama refaz a leitura da página com o resultado. A simulação tem de ser do próprio aluno (o
 * backend só lhe devolve o resultado dele) e uma prova de sala nunca se corrige aqui: a nota dela vem da pauta.
 */
export async function tentarCorrecaoDeNovo(simulationId: number): Promise<{ ok: boolean }> {
  await requireStudent();
  if (!Number.isInteger(simulationId) || simulationId <= 0 || !correcaoLigada()) return { ok: false };
  const [view, me, salas] = await Promise.all([getResultView(simulationId), getMe(), listInvitations()]);
  if (view.kind !== 'ok' || !me || view.statementId == null || !salas.ok) return { ok: false };
  if (!eSimulacaoLivre(view.result.simulationId, salas.data)) return { ok: false };
  const abertura = await correcaoDaSimulacao({ me, simulationId: view.result.simulationId, statementId: view.statementId });
  return { ok: abertura != null && abertura.vista.kind !== 'falhou' };
}
