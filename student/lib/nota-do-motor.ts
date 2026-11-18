import 'server-only';

import { listInvitations } from './exam-room';
import { notaDoMotorDe } from './nota-da-simulacao.ts';
import { correcaoLigada } from './schoolops/correcao';

/**
 * Marca as simulações cuja nota autoritativa é a do SchoolOps (#820).
 *
 * O motor corrige as simulações livres e devolve uma nota 0–20; o `finalScore` do Kixi
 * está na cotação da prova. Fora do resultado, mostrá-lo seria outro número — por isso
 * a regra única (`nota-da-simulacao`) esconde-o e diz «Corrigida».
 *
 * Só se pergunta pelas salas quando o motor está ligado; a leitura é a mesma da página
 * (`listInvitations` é `cache`) e não se repete por simulação. Se as salas não se
 * conseguirem ler, esconde-se o número em vez de arriscar mostrar o errado.
 */
export async function marcarNotaDoMotor<T extends { id: number }>(
  simulacoes: T[],
): Promise<(T & { notaDoMotor: boolean })[]> {
  if (!correcaoLigada()) return simulacoes.map((s) => ({ ...s, notaDoMotor: false }));

  const salas = await listInvitations().catch(() => null);
  const deSala = salas?.ok
    ? new Set(salas.data.map((s) => s.simulationId).filter((id): id is number => id != null))
    : null;

  return simulacoes.map((s) => ({ ...s, notaDoMotor: notaDoMotorDe(s.id, deSala) }));
}
