'use client';

import { useEffect } from 'react';
import { limparRascunho } from '@/lib/draft-store';
import { limparMarcadas } from '@/lib/flag-store';

/** O resultado é o fim da tentativa: as marcas «para rever» e o rascunho local
 *  dessa simulação já não servem para nada e não ficam no browser (#486). */
export function ClearExamLocal({ simulationId }: { simulationId: number }) {
  useEffect(() => {
    try {
      const armazem = window.localStorage;
      limparRascunho(armazem, simulationId);
      limparMarcadas(armazem, simulationId);
    } catch {
      // sem armazenamento local não há nada para limpar
    }
  }, [simulationId]);

  return null;
}
