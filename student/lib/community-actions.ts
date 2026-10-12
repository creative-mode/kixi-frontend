'use server';

import { revalidatePath } from 'next/cache';
import { getSharedSolutions, shareSolution, unshareSolution, type SharedSolution } from './community';

export async function shareSolutionAction(
  statementId: number,
  simulationId: number,
  anonymous: boolean,
  displayName?: string,
): Promise<{ ok: boolean; message?: string }> {
  const result = await shareSolution(simulationId, anonymous, displayName);
  if (!result.ok) return { ok: false, message: result.message };
  revalidatePath(`/prova/${statementId}/detalhe`);
  return { ok: true };
}

/** Re-pede as resoluções partilhadas filtradas por escola - chamado do cliente
 *  quando o aluno muda o filtro, sem recarregar a página toda. */
export async function filterSharedSolutionsAction(
  statementId: number,
  institutionId?: number,
): Promise<{ ok: boolean; solutions: SharedSolution[] }> {
  const result = await getSharedSolutions(statementId, institutionId);
  return result.ok ? { ok: true, solutions: result.data.content } : { ok: false, solutions: [] };
}

export async function unshareSolutionAction(
  statementId: number,
  simulationId: number,
): Promise<{ ok: boolean }> {
  const result = await unshareSolution(simulationId);
  if (result.ok) revalidatePath(`/prova/${statementId}/detalhe`);
  return { ok: result.ok };
}
