'use client';

import { useSyncExternalStore } from 'react';

/** Mesmo padrão de lib/theme.ts: o estado vive no atributo `data-reduce-motion`
 *  de <html>, escrito pelo script inline de app/layout.tsx antes da primeira
 *  pintura, e lido como um external store para se manter em sincronia se
 *  mudar noutro separador. Sem campo no backend para isto (ao contrário do
 *  tempo extra, que é do aluno mas só o administrador escreve) — é uma
 *  preferência de interface, guardada como tal. */

const listeners = new Set<() => void>();

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  const observer = new MutationObserver(() => listeners.forEach((listener) => listener()));
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-reduce-motion'] });
  return () => {
    listeners.delete(onChange);
    observer.disconnect();
  };
}

const read = () => document.documentElement.getAttribute('data-reduce-motion') === 'true';
const readServer = () => false;

export function useReduceMotion(): boolean {
  return useSyncExternalStore(subscribe, read, readServer);
}

export function setReduceMotion(reduce: boolean): void {
  document.documentElement.setAttribute('data-reduce-motion', String(reduce));
  try {
    localStorage.setItem('kixi-reduce-motion', String(reduce));
  } catch {
    /* modo privado ou quota */
  }
}
