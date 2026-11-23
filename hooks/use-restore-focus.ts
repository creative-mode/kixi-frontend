'use client';

import { useRef } from 'react';
import { restoreTarget } from '@/lib/restore-focus';

type Handler = (event: Event) => void;

/**
 * Para o `Content` de um diálogo aberto por estado (sem `Trigger`): guarda quem tinha o foco ao abrir e devolve-lho ao fechar
 * (Esc, Cancelar ou fechar), quando o foco se perdeu. Os handlers que o diálogo já tinha correm primeiro e, se fizerem
 * `preventDefault`, mandam eles (é o caso da fila de moderação, que devolve o foco à mão).
 */
export function useRestoreFocus({ onOpenAutoFocus, onCloseAutoFocus }: { onOpenAutoFocus?: Handler; onCloseAutoFocus?: Handler }) {
  const opener = useRef<HTMLElement | null>(null);
  return {
    onOpenAutoFocus: (event: Event) => {
      // O Radix chama isto antes de mover o foco para dentro: o `activeElement` ainda é o botão que abriu.
      opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      onOpenAutoFocus?.(event);
    },
    onCloseAutoFocus: (event: Event) => {
      onCloseAutoFocus?.(event);
      const target = event.defaultPrevented ? null : restoreTarget(opener.current, document.activeElement, document.body);
      opener.current = null;
      if (!target) return;
      event.preventDefault();
      target.focus();
    },
  };
}
