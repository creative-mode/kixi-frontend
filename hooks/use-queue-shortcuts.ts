'use client';

import { useEffect, useRef } from 'react';
import { shortcutKey } from '@/lib/queue-shortcuts';
import { stepIndex } from '@/lib/queue-state';

/** Onde se escreve: campos, seletores, áreas de texto, qualquer coisa editável e o editor de fórmulas (MathLive). */
function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  if (target.closest('input, textarea, select, math-field, [contenteditable=""], [contenteditable="true"]')) return true;
  const role = target.getAttribute('role');
  return role === 'textbox' || role === 'combobox' || role === 'searchbox' || role === 'spinbutton';
}

/**
 * Atalhos de teclado de uma fila: `{ j: seguinte, a: aprovar }`. Só disparam com o foco fora de um campo, sem
 * modificadores e sem diálogo aberto (ver `shortcutKey`). Cada atalho abre o mesmo fluxo que o botão da página:
 * nenhum decide nada sozinho.
 */
export function useQueueShortcuts(handlers: Record<string, () => void>, enabled = true) {
  const latest = useRef(handlers);
  useEffect(() => {
    latest.current = handlers;
  });

  useEffect(() => {
    if (!enabled) return;
    function onKeyDown(event: KeyboardEvent) {
      const key = shortcutKey(
        event,
        { editable: isEditable(event.target), dialogOpen: document.querySelector('[role="dialog"], [role="alertdialog"]') !== null },
        Object.keys(latest.current),
      );
      if (key === null) return;
      event.preventDefault();
      latest.current[key]?.();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [enabled]);
}

/** Os itens de uma fila que se percorrem com J e K: marcam-se com `data-fila-item` (e `tabIndex={-1}`). */
function queueItems(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>('[data-fila-item]'));
}

/** Passa o foco ao item seguinte (`1`) ou anterior (`-1`) da fila; nas pontas pára. */
export function focusQueueItem(step: 1 | -1) {
  const items = queueItems();
  const current = items.findIndex((item) => item.contains(document.activeElement));
  const target = stepIndex(current, items.length, step);
  if (target !== null) items[target]!.focus();
}

/** O item da fila onde está o foco (o «atual» a que A e R se referem), pelo `data-fila-id`; `null` se o foco está fora. */
export function focusedQueueId(): string | null {
  return queueItems().find((item) => item.contains(document.activeElement))?.dataset.filaId ?? null;
}
