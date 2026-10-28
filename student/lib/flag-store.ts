/** Marcações «para rever» guardadas por simulação (#486), puras para o `node --test`
 *  as alcançar.
 *
 *  Antes viviam só em `useState`: recarregar a sala ou sair e voltar apagava-as,
 *  embora sejam parte do plano do aluno para a prova. Ficam no mesmo `localStorage`
 *  do rascunho (#587), por simulação, e são limpas quando a tentativa termina. */

import type { Armazem } from './draft-store';

const VERSAO = 1;

export const chaveMarcadas = (simulationId: number): string => `kixi:marcadas:${simulationId}`;

/** Sem marcações apaga a entrada: não vale a pena deixar uma lista vazia no browser. */
export function guardarMarcadas(armazem: Armazem, simulationId: number, marcadas: Iterable<number>): void {
  try {
    const ids = [...new Set(marcadas)].filter((id) => Number.isInteger(id) && id > 0).sort((a, b) => a - b);
    if (ids.length === 0) {
      armazem.removeItem(chaveMarcadas(simulationId));
      return;
    }
    armazem.setItem(chaveMarcadas(simulationId), JSON.stringify({ v: VERSAO, marcadas: ids }));
  } catch {
    // sem armazenamento a sala continua a funcionar; só não sobrevive a um reload
  }
}

/** As marcações desta simulação; vazio se não existem, estão estragadas ou são de
 *  outra versão — e nesse caso a entrada é apagada. */
export function lerMarcadas(armazem: Armazem, simulationId: number): Set<number> {
  const chave = chaveMarcadas(simulationId);
  try {
    const bruto = armazem.getItem(chave);
    if (!bruto) return new Set();
    const dados = JSON.parse(bruto) as { v?: unknown; marcadas?: unknown };
    if (dados.v !== VERSAO || !Array.isArray(dados.marcadas)) {
      armazem.removeItem(chave);
      return new Set();
    }
    return new Set(dados.marcadas.filter((id): id is number => typeof id === 'number' && Number.isInteger(id) && id > 0));
  } catch {
    try {
      armazem.removeItem(chave);
    } catch {
      // nada a fazer
    }
    return new Set();
  }
}

export function limparMarcadas(armazem: Armazem, simulationId: number): void {
  try {
    armazem.removeItem(chaveMarcadas(simulationId));
  } catch {
    // nada a fazer
  }
}
