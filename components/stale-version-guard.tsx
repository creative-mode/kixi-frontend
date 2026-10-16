'use client';

import { useEffect } from 'react';
import { toast } from 'sonner';

/** O que o Next diz quando a página aberta é de uma versão anterior à que está em produção: o pedido da
 *  ação segue com um identificador que o servidor novo já não conhece. */
const STALE = /unexpected response was received from the server|Failed to find Server Action/i;

/**
 * Depois de uma nova versão, uma página que ficou aberta deixa de conseguir gravar: o clique não faz nada
 * e o professor vê "nada é persistido". Aqui o erro aparece, com o caminho para o resolver (recarregar).
 */
export function StaleVersionGuard() {
  useEffect(() => {
    const warn = (reason: unknown) => {
      const text = reason instanceof Error ? reason.message : String(reason ?? '');
      if (!STALE.test(text)) return;
      toast.error('Esta página é de uma versão anterior e não consegue gravar. Recarregue para continuar.', {
        id: 'versao-desatualizada',
        duration: Infinity,
        action: { label: 'Recarregar', onClick: () => window.location.reload() },
      });
    };
    const onRejection = (e: PromiseRejectionEvent) => warn(e.reason);
    const onError = (e: ErrorEvent) => warn(e.error ?? e.message);
    window.addEventListener('unhandledrejection', onRejection);
    window.addEventListener('error', onError);
    return () => {
      window.removeEventListener('unhandledrejection', onRejection);
      window.removeEventListener('error', onError);
    };
  }, []);
  return null;
}
