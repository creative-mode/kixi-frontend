'use client';

import { useCallback, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { parseChoice, parsePage, queryWith } from '@/lib/queue-state';
import { parseSortLabel, type SortDir } from '@/lib/crud/list-state';

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

const SORT_DIRS = ['asc', 'desc'] as const;

/** Pesquisa, ordenação e página de uma listagem no endereço (`?q=&sort=&dir=&page=`).
 *
 *  Sobrevive ao recarregamento e às ligações diretas; o endereço é a única fonte
 *  da verdade. `sort` é o `label` da coluna (uma ligação partilhada não se parte
 *  se as colunas mudarem de ordem); desconhecido conta como sem ordenação.
 *  Valores padrão não se escrevem, para o endereço limpo ser o deles.
 *  O estado vive no React (o `replaceState` não re-renderiza por si) e espelha-se
 *  no endereço; recarregar lê do endereço. Quem usa precisa de um `Suspense` por
 *  cima (ver a página).
 */
export function useListState(labels: readonly string[]) {
  const params = useSearchParams();
  const [q, setQState] = useState(() => params.get('q') ?? '');
  const [sort, setSortState] = useState<number | null>(() => parseSortLabel(params.get('sort'), labels));
  const [dir, setDirState] = useState<SortDir>(() => parseChoice(params.get('dir'), SORT_DIRS, 'asc'));
  const [page, setPageState] = useState(() => parsePage(params.get('page')));

  const write = useCallback((patch: Record<string, string | null>) => replaceQuery(patch), []);

  const setQ = useCallback(
    (next: string) => {
      setQState(next);
      setPageState(1);
      write({ q: next.trim() === '' ? null : next, page: null });
    },
    [write],
  );

  const setDir = useCallback(
    (next: SortDir) => {
      setDirState(next);
      write({ dir: next === 'asc' ? null : next });
    },
    [write],
  );

  const clearSort = useCallback(() => {
    setSortState(null);
    setDirState('asc');
    setPageState(1);
    write({ sort: null, dir: null, page: null });
  }, [write]);

  /** Cabeçalho clicável: crescente, decrescente, e ao terceiro clique sai a ordenação. */
  const cycleSort = useCallback(
    (index: number) => {
      if (sort !== index) {
        setSortState(index);
        setDirState('asc');
        setPageState(1);
        write({ sort: labels[index] ?? null, dir: null, page: null });
      } else if (dir === 'asc') {
        setDir('desc');
      } else {
        clearSort();
      }
    },
    [sort, dir, labels, write, setDir, clearSort],
  );

  const setPage = useCallback(
    (next: number) => {
      setPageState(next);
      write({ page: next <= 1 ? null : String(next) });
    },
    [write],
  );

  // A query pronta a levar para o editar/criar, para o voltar restaurar a vista.
  const queryString = queryWith('', {
    q: q.trim() === '' ? null : q,
    sort: sort === null ? null : (labels[sort] ?? null),
    dir: sort === null || dir === 'asc' ? null : dir,
    page: page <= 1 ? null : String(page),
  });

  return { q, setQ, sort, dir, setDir, clearSort, cycleSort, page, setPage, queryString };
}
