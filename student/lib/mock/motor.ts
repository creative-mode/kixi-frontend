import 'server-only';
import { MOCK } from './store';
import type { CorrecaoEstado } from '../schoolops/correcao-rules';

// O SchoolOps não existe no modo de demonstração: sem SCHOOLOPS_URL a correcção está desligada e o resultado mostra-se
// como o backend o dá. Para se ver (e testar) o ecrã de espera com o progresso e a previsão do motor (#792), uma
// simulação pode ter um estado do motor combinado à mão, pela rota `/api/mock-correcao`. Só as simulações com estado
// combinado passam pela espera; as outras ficam como estavam.

const G = globalThis as unknown as { __kixiMotor?: Map<number, CorrecaoEstado> };
const estados = (): Map<number, CorrecaoEstado> => (G.__kixiMotor ??= new Map());

/** Combina o estado do motor de uma simulação; `null` tira-o e a simulação volta ao que era. */
export function setMotorSimulado(simulationId: number, estado: Omit<CorrecaoEstado, 'correcaoId'> | null): void {
  if (estado === null) estados().delete(simulationId);
  else estados().set(simulationId, { correcaoId: `CR-MOCK${String(simulationId).padStart(11, '0')}`, ...estado });
}

/** O estado combinado de uma simulação; sempre null fora do modo de demonstração. */
export function motorSimulado(simulationId: number): CorrecaoEstado | null {
  return MOCK ? (estados().get(simulationId) ?? null) : null;
}
