'use client';

import { useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { parseChoice, parsePage, queryWith } from '@/lib/queue-state';

/** Escreve no endereço sem entradas novas no histórico nem pedido ao servidor: o Next sincroniza `replaceState` com o router. */
function replaceQuery(patch: Record<string, string | null>) {
  const query = queryWith(window.location.search, patch);
  window.history.replaceState(null, '', `${window.location.pathname}${query}`);
}

/**
 * Uma escolha guardada no endereço (`?filtro=rever`): sobrevive ao recarregamento e às ligações diretas, e o
 * endereço é a única fonte da verdade, por isso uma ligação para a mesma página sem parâmetro volta ao padrão.
 * Um valor que não é dos permitidos conta como o padrão, e o padrão não se escreve: o endereço limpo é o dele.
 * Quem usa precisa de um `Suspense` por cima (ver a página).
 */
export function useQueryChoice<T extends string>(key: string, allowed: readonly T[], fallback: T): [T, (next: T) => void] {
  const value = parseChoice(useSearchParams().get(key), allowed, fallback);
  const set = useCallback((next: T) => replaceQuery({ [key]: next === fallback ? null : next }), [key, fallback]);
  return [value, set];
}

/** A página de uma lista no endereço (`?pagina=2`); a primeira não se escreve. */
export function useQueryPage(key = 'pagina'): [number, (next: number) => void] {
  const page = parsePage(useSearchParams().get(key));
  const set = useCallback((next: number) => replaceQuery({ [key]: next <= 1 ? null : String(next) }), [key]);
  return [page, set];
}
