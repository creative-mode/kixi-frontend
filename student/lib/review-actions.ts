'use server';

import { requireStudent } from './guard';
import { apiPost } from './api';
import { translateError } from './exam-rules';

export type ReviewRequestResult =
  | { ok: true; message: string }
  | { ok: false; message: string };

/** Pede a revisão de uma resposta corrigida pela IA numa simulação livre. */
export async function pedirRevisaoAction(simulationId: number, questionId: number, motivo: string): Promise<ReviewRequestResult> {
  await requireStudent();

  if (!Number.isInteger(simulationId) || simulationId <= 0) {
    return { ok: false, message: 'Simulação inválida.' };
  }
  if (!Number.isInteger(questionId) || questionId <= 0) {
    return { ok: false, message: 'Questão inválida.' };
  }
  if (!motivo.trim()) {
    return { ok: false, message: 'Tens de explicar por que não concordas com a correcção.' };
  }

  try {
    const result = await apiPost<{ message: string }>(`/simulations/${simulationId}/review`, {
      questionId,
      motivo: motivo.trim(),
    });
    if (!result.ok) {
      return { ok: false, message: translateError(result.message) };
    }
    return { ok: true, message: result.data.message ?? 'Pedido de revisão enviado. O professor vai analisar.' };
  } catch {
    return { ok: false, message: 'Sem ligação ao servidor. Tenta de novo mais tarde.' };
  }
}