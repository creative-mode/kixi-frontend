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
  /** kixi#609: PENDING, IN_PROGRESS, DONE ou FAILED. O backend calcula-o para qualquer
   *  simulação entregue, sala incluída. */
  correctionStatus?: string | null;
  correctedAt?: string | null;
  /** A nota que vale é a do motor (0–20), que não está nesta resposta: mostra-se o
   *  estado e o link para o resultado em vez de um número (#791/#820). */
  notaDoMotor?: boolean;
}

/**
 * - `nota`: a nota final, a mesma do ecrã de resultado;
 * - `nota-no-resultado`: a nota é a do motor e só o resultado a sabe (0–20); um número
 *   aqui seria outro número;
 * - `a-corrigir`: há dissertativas por corrigir; mostrar a nota parcial seria mostrar outra nota;
 * - `falhou`: o motor não conseguiu corrigir (kixi#609 avisa);
 * - `sem-nota`: não há nota para mostrar (simulação por entregar, ou corrigida sem nota).
 */
export type NotaDaSimulacao =
  | { kind: 'nota'; nota: number }
  | { kind: 'nota-no-resultado' }
  | { kind: 'a-corrigir' }
  | { kind: 'falhou' }
  | { kind: 'sem-nota' };

/** DONE, ou um backend anterior ao kixi#609 (sem estado). Um estado que não conhecemos
 *  não é DONE: é melhor dizer «A corrigir» do que inventar uma nota (#820). */
const terminada = (estado: string) => estado === '' || estado === 'DONE';

export function notaDaSimulacao(simulacao: SimulacaoComNota): NotaDaSimulacao {
  const estado = (simulacao.correctionStatus ?? '').toUpperCase();
  if (!terminada(estado)) {
    return estado === 'FAILED' ? { kind: 'falhou' } : { kind: 'a-corrigir' };
  }
  if (simulacao.notaDoMotor) return { kind: 'nota-no-resultado' };
  return simulacao.finalScore == null ? { kind: 'sem-nota' } : { kind: 'nota', nota: simulacao.finalScore };
}

/** A nota numérica, ou null: é o que se pode somar, comparar ou pôr num gráfico. Um
 *  `nota-no-resultado` continua a ter `finalScore` para percentagens (o resultado é que
 *  mostra o valor em 0–20), por isso esta não passa pela regra de apresentação. */
export function notaFinal(simulacao: SimulacaoComNota): number | null {
  const estado = (simulacao.correctionStatus ?? '').toUpperCase();
  if (!terminada(estado)) return null;
  return simulacao.finalScore ?? null;
}

/** A nota que vale é a do motor quando a simulação é livre. `null` em `deSala` quer dizer
 *  que não se conseguiu ler as salas: esconde-se o número em vez de arriscar o errado. */
export function notaDoMotorDe(id: number, deSala: ReadonlySet<number> | null): boolean {
  return deSala === null ? true : !deSala.has(id);
}

/** O sufixo da notificação «Terminaste…»: « com 14,5», « — a corrigir», « — corrigida» ou
 *  vazio. Fica aqui para o texto do sino ser testável sem React (#820). */
export function sufixoDaNota(simulacao: SimulacaoComNota): string {
  const nota = notaDaSimulacao(simulacao);
  if (nota.kind === 'nota') return ` com ${String(nota.nota).replace('.', ',')}`;
  const estado = estadoDaNotaEmPalavras(simulacao);
  return estado ? ` — ${estado.toLowerCase()}` : '';
}

/** O que dizer no lugar da nota, ou null quando há nota (ou não há nada a dizer). */
export function estadoDaNotaEmPalavras(simulacao: SimulacaoComNota): 'A corrigir' | 'Correção falhou' | 'Corrigida' | null {
  const nota = notaDaSimulacao(simulacao);
  if (nota.kind === 'a-corrigir') return 'A corrigir';
  if (nota.kind === 'falhou') return 'Correção falhou';
  if (nota.kind === 'nota-no-resultado') return 'Corrigida';
  return null;
}
