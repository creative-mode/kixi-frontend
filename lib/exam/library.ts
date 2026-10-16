/**
 * A biblioteca de enunciados: filtrar os de todas as escolas pelos modos que o professor e o administrador usam.
 * Pura e sem React, para o `node --test` chegar cá.
 */

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export type StateFilter = 'all' | 'published' | 'hidden' | 'review';

export interface LibraryFilters {
  q: string;
  institutionId: string;
  subjectId: string;
  examType: string;
  schoolYearId: string;
  state: StateFilter;
  source: string;
}

export const EMPTY_FILTERS: LibraryFilters = { q: '', institutionId: '', subjectId: '', examType: '', schoolYearId: '', state: 'all', source: '' };

const plain = (text: unknown) => String(text ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/** Se o enunciado passa em todos os filtros activos. Cada um vazio deixa passar tudo. */
export function matches(row: Row, f: LibraryFilters): boolean {
  if (f.q.trim()) {
    const haystack = plain([row.title, row.examType, row.variant, row.instructions].join(' '));
    if (!f.q.trim().split(/\s+/).every((word) => haystack.includes(plain(word)))) return false;
  }
  if (f.institutionId && String(row.institutionId ?? '') !== f.institutionId) return false;
  if (f.subjectId && String(row.subjectId ?? '') !== f.subjectId) return false;
  if (f.schoolYearId && String(row.schoolYearId ?? '') !== f.schoolYearId) return false;
  if (f.examType && plain(row.examType) !== plain(f.examType)) return false;
  if (f.source && plain(row.source) !== plain(f.source)) return false;
  if (f.state === 'published' && !row.visible) return false;
  if (f.state === 'hidden' && row.visible) return false;
  if (f.state === 'review' && !row.needsReview) return false;
  return true;
}

export const filterStatements = (rows: readonly Row[], f: LibraryFilters): Row[] => rows.filter((r) => matches(r, f));

/** Quantos filtros estão activos (para o botão «Limpar» e o contador). */
export function activeFilters(f: LibraryFilters): number {
  return [f.q.trim(), f.institutionId, f.subjectId, f.examType, f.schoolYearId, f.state !== 'all' ? f.state : '', f.source].filter(Boolean).length;
}

/** Os valores distintos de um campo, por ordem, para os filtros que dependem do que existe (tipo de prova, origem). */
export function distinct(rows: readonly Row[], field: string): string[] {
  return [...new Set(rows.map((r) => String(r[field] ?? '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt'));
}

/** As escolas, disciplinas e anos que os enunciados têm, para os filtros só oferecerem o que traz resultados. */
export function idsUsed(rows: readonly Row[], field: 'institutionId' | 'subjectId' | 'schoolYearId'): Set<string> {
  return new Set(rows.map((r) => r[field]).filter((v) => v != null).map(String));
}
