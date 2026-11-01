'use client';

import { useEffect, useRef, useSyncExternalStore } from 'react';
import { parseShortcutsPref, shortcutKey, SHORTCUTS_PREF_KEY } from '@/lib/queue-shortcuts';
import { stepIndex } from '@/lib/queue-state';

/** Onde se escreve ou se navega por teclas: campos, seletores, áreas de texto, editáveis, o editor de fórmulas (MathLive), listas de opções e deslizadores. */
function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  if (target.closest('input, textarea, select, math-field, [contenteditable=""], [contenteditable="true"]')) return true;
  const role = target.getAttribute('role');
  // Também os controlos que usam letras e setas por si (lista de opções, deslizador).
  return ['textbox', 'combobox', 'searchbox', 'spinbutton', 'listbox', 'slider'].includes(role ?? '');
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

/**
 * A preferência de ter atalhos de uma só tecla (WCAG 2.1.4, nível A: quem usa ditado ou um teclado que dispara teclas
 * sem querer tem de os poder desligar). Fica neste navegador e vale para as três filas; sem armazenamento (modo
 * privado) guarda-se só enquanto a página vive, para o interruptor funcionar na mesma.
 */
const SHORTCUTS_EVENT = 'kixi:atalhos';
let shortcutsInMemory = true;

function subscribeShortcuts(onChange: () => void) {
  window.addEventListener('storage', onChange);
  window.addEventListener(SHORTCUTS_EVENT, onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener(SHORTCUTS_EVENT, onChange);
  };
}

function readShortcuts(): boolean {
  try {
    return parseShortcutsPref(window.localStorage.getItem(SHORTCUTS_PREF_KEY));
  } catch {
    return shortcutsInMemory;
  }
}

export function setShortcutsEnabled(next: boolean) {
  shortcutsInMemory = next;
  try {
    window.localStorage.setItem(SHORTCUTS_PREF_KEY, next ? 'on' : 'off');
  } catch {
    // Sem armazenamento: vale só nesta página.
  }
  window.dispatchEvent(new Event(SHORTCUTS_EVENT));
}

/** `[ligados, mudar]`. No servidor (e na hidratação) vêm ligados, como por omissão. */
export function useShortcutsEnabled(): [boolean, (next: boolean) => void] {
  return [useSyncExternalStore(subscribeShortcuts, readShortcuts, () => true), setShortcutsEnabled];
}
