'use server';

import { requireStudent } from './guard.ts';
import { apiPost } from './api.ts';
import { translateError } from './exam-rules.ts';

export type ReviewRequestResult =
  | { ok: true; message: string }
  | { ok: false; message: string };

const MAX_MOTIVO_LENGTH = 1000; // TODO: alinhar com contrato backend

/** Pede a revisão de uma resposta corrigida pela IA numa simulação livre.
 *  NOTA: Endpoint POST /simulations/{id}/review não existe ainda no backend (kixi#798 Fase 2).
 *  Esta action falhará com 404 até o backend implementar o contrato. */
export async function pedirRevisaoAction(simulationId: number, questionId: number, motivo: string): Promise<ReviewRequestResult> {
  await requireStudent();

  if (!Number.isInteger(simulationId) || simulationId <= 0) {
    return { ok: false, message: 'Simulação inválida.' };
  }
  if (!Number.isInteger(questionId) || questionId <= 0) {
    return { ok: false, message: 'Questão inválida.' };
  }
  const trimmed = motivo.trim();
  if (!trimmed) {
    return { ok: false, message: 'Tens de explicar por que não concordas com a correção.' };
  }
  if (trimmed.length > MAX_MOTIVO_LENGTH) {
    return { ok: false, message: `O motivo não pode exceder ${MAX_MOTIVO_LENGTH} caracteres.` };
  }

  try {
    const result = await apiPost<{ message: string }>(`/simulations/${simulationId}/review`, {
      questionId,
      motivo: trimmed,
    });
    if (!result.ok) {
      // 409 = já existe pedido; 404 = endpoint não implementado; outros = erro servidor
      return { ok: false, message: translateError(result.message) };
    }
    // HTTP 204 (No Content) => result.data é undefined
    // Não assumir que result.data.message existe
    return { ok: true, message: result.data?.message ?? 'Pedido de revisão enviado. O professor vai analisar.' };
  } catch {
    return { ok: false, message: 'Sem ligação ao servidor. Tenta de novo mais tarde.' };
  }
}
