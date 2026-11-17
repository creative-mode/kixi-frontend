/**
 * A nota de uma simulação só existe quando a correcção está feita (kixi#609).
 *
 * Fora do ecrã de resultado, o backend devolve a nota parcial (só as fechadas) enquanto as
 * dissertativas estão por corrigir. Mostrá-la no histórico, nas notificações ou no desempenho
 * era o #791: o mesmo aluno via três notas diferentes — ou nenhuma — para a mesma prova.
 *
 * Esta é a única regra: quem mostra uma nota lê-a daqui, e quem não tem nota mostra o estado da
 * correcção em vez de inventar um número.
 */

/** `PENDING` e `IN_PROGRESS` vêm do `correctionStatus` das simulações livres (kixi#609). */
export type EstadoDaCorrecao = 'PENDING' | 'IN_PROGRESS' | 'DONE' | 'FAILED';

/** Uma simulação como `GET /simulations` a devolve, só com o que esta regra lê. */
export interface SimulacaoComNota {
  finalScore?: number | null;
  /** Ausente numa prova de sala (a nota vem da pauta) e num backend anterior ao kixi#609. */
  correctionStatus?: string | null;
  correctedAt?: string | null;
}

/**
 * - `nota`: a nota final, a mesma do ecrã de resultado;
 * - `a-corrigir`: há dissertativas por corrigir; mostrar a nota parcial seria mostrar outra nota;
 * - `falhou`: o motor não conseguiu corrigir (kixi#609 avisa);
 * - `sem-nota`: não há nota para mostrar (simulação por entregar, ou corrigida sem nota).
 */
export type NotaDaSimulacao =
  | { kind: 'nota'; nota: number }
  | { kind: 'a-corrigir' }
  | { kind: 'falhou' }
  | { kind: 'sem-nota' };

export function notaDaSimulacao(simulacao: SimulacaoComNota): NotaDaSimulacao {
  const estado = (simulacao.correctionStatus ?? '').toUpperCase();
  if (estado === 'PENDING' || estado === 'IN_PROGRESS') return { kind: 'a-corrigir' };
  if (estado === 'FAILED') return { kind: 'falhou' };
  // DONE, ou um backend anterior ao kixi#609 (prova de sala): a nota que houver é a final.
  return simulacao.finalScore == null ? { kind: 'sem-nota' } : { kind: 'nota', nota: simulacao.finalScore };
}

/** A nota final, ou null: é o que se pode somar, comparar ou pôr num gráfico. */
export function notaFinal(simulacao: SimulacaoComNota): number | null {
  const nota = notaDaSimulacao(simulacao);
  return nota.kind === 'nota' ? nota.nota : null;
}

/** O que dizer no lugar da nota, ou null quando há nota (ou não há nada a dizer). */
export function estadoDaNotaEmPalavras(simulacao: SimulacaoComNota): 'A corrigir' | 'Correção falhou' | null {
  const nota = notaDaSimulacao(simulacao);
  if (nota.kind === 'a-corrigir') return 'A corrigir';
  if (nota.kind === 'falhou') return 'Correção falhou';
  return null;
}
