/**
 * O que fazer depois de ler o estado da correção (#794).
 *
 * Enquanto o motor diz `a-corrigir`, o ecrã continua a ler. Quando a correção termina
 * (corrigida, incompleta ou falhou), pede-se **uma** recarga da página para mostrar o
 * resultado — e pára-se o ciclo. Sem isto, um tick seguinte podia disparar outra recarga
 * enquanto a primeira ainda estava a chegar (#813).
 */
export type PassoDepoisDaLeitura = 'continuar' | 'terminar';

export function passoDepoisDaLeitura(kind: string): PassoDepoisDaLeitura {
  return kind === 'a-corrigir' ? 'continuar' : 'terminar';
}
