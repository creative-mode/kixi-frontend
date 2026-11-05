import { isValidElement, type ReactNode } from 'react';

/** Uma coluna que pinta texto: o suficiente para pesquisar e ordenar pelo visível. */
export interface TextColumn {
  value: (row: Record<string, unknown>, labels?: Record<string, string>) => ReactNode;
}

export type SortDir = 'asc' | 'desc';

/** O texto que uma célula pinta: extrai strings e números do ReactNode, por
 *  dentro de `<strong>`, `<code>`, fragmentos e listas. Botões e ícones sem
 *  texto contam zero — e é por isso que a pesquisa só casa com o visível. */
export function cellText(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(cellText).filter(Boolean).join(' ');
  if (isValidElement<{ children?: ReactNode }>(node)) return cellText(node.props.children);
  return '';
}

/** A linha em texto pesquisável: só as colunas visíveis. Ids, URLs de imagem e
 *  campos internos que nenhuma coluna pinta nunca casam. */
export function rowText(
  row: Record<string, unknown>,
  columns: readonly TextColumn[],
  labels?: Record<string, string>,
): string {
  return columns
    .map((c) => {
      try {
        return cellText(c.value(row, labels));
      } catch {
        return '';
      }
    })
    .filter(Boolean)
    .join(' ');
}

/** A pesquisa casa com qualquer coluna visível; vazia mostra tudo. */
export function matchesQuery(
  row: Record<string, unknown>,
  columns: readonly TextColumn[],
  labels: Record<string, string> | undefined,
  query: string,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return rowText(row, columns, labels).toLowerCase().includes(q);
}

/** Ordena pelo texto visível da coluna (`localeCompare` numérico: 2 < 10).
 *  Datas formatadas ordenam como texto — aceita-se: a ordem é sempre a do que
 *  se vê, nunca a de um campo escondido. */
export function sortRows<T>(rows: readonly T[], key: (row: T) => string, dir: SortDir): T[] {
  const sorted = [...rows].sort((a, b) => key(a).localeCompare(key(b), 'pt', { numeric: true }));
  return dir === 'desc' ? sorted.reverse() : sorted;
}

/** O índice da coluna no endereço: procura-se pelo `label` (estável a
 *  reordenações, ao contrário do índice); desconhecido conta como sem ordenação. */
export function parseSortLabel(raw: string | string[] | null | undefined, labels: readonly string[]): number | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value === null || value === undefined || value === '') return null;
  const index = labels.indexOf(value);
  return index === -1 ? null : index;
}
