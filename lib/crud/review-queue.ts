/** A fila de enunciados por rever e os filtros da lista: sem React, testável com `node --test`. */

export type StatementFilter = 'todos' | 'rever' | 'ocr';

export const STATEMENT_FILTERS: { key: StatementFilter; label: string }[] = [
  { key: 'todos', label: 'Todos' },
  { key: 'rever', label: 'Para rever' },
  { key: 'ocr', label: 'Vindos do OCR' },
];

export const STATEMENT_FILTER_KEYS = STATEMENT_FILTERS.map((f) => f.key);

interface StatementLike {
  needsReview?: unknown;
  source?: unknown;
}

/** O backend guarda `ocr` em minúsculas e o simulado `OCR`: compara-se sem distinguir. */
const fromOcr = (row: StatementLike) => String(row.source ?? '').toLowerCase() === 'ocr';

/** Igual ao que `GET /statements/review` e `/from-ocr` filtram no servidor (`needsReview` e `source = 'ocr'`). */
export function matchesStatementFilter(row: StatementLike, filter: StatementFilter): boolean {
  if (filter === 'rever') return row.needsReview === true;
  if (filter === 'ocr') return fromOcr(row);
  return true;
}

export function statementCounts(rows: readonly StatementLike[]): Record<StatementFilter, number> {
  return {
    todos: rows.length,
    rever: rows.filter((r) => matchesStatementFilter(r, 'rever')).length,
    ocr: rows.filter((r) => matchesStatementFilter(r, 'ocr')).length,
  };
}

/** Os ids por rever, pela ordem em que a lista os traz. */
export function reviewQueue(rows: readonly (StatementLike & { id?: unknown })[]): number[] {
  return rows.filter((r) => matchesStatementFilter(r, 'rever')).map((r) => Number(r.id));
}

export interface QueuePlace {
  /** A posição de `current` na fila (a partir de 1), ou `null` se já não está lá. */
  position: number | null;
  total: number;
  previous: number | null;
  /** Para andar pela fila: o que vem a seguir, e `null` no último (não dá a volta). */
  following: number | null;
  /** O que se abre depois de aprovar `current`: o seguinte, ou, no fim, o primeiro que ainda sobra. */
  next: number | null;
}

export function queuePlace(queue: readonly number[], current: number): QueuePlace {
  const index = queue.indexOf(current);
  const others = queue.filter((id) => id !== current);
  return {
    position: index === -1 ? null : index + 1,
    total: queue.length,
    previous: index > 0 ? queue[index - 1]! : null,
    following: index !== -1 && index < queue.length - 1 ? queue[index + 1]! : null,
    next: (index === -1 ? others[0] : queue[index + 1] ?? others[0]) ?? null,
  };
}
