/** Catalog paging and filtering, the rule StatementCatalogController applies:
 *  flat rows narrowed by id filters, `q` matched case-insensitively against
 *  title and exam type, and a 0-based page cut. Kept free of `server-only` so
 *  `node --test` can exercise it; `mock/backend.ts` just wires it to the store. */

export interface CatalogRow {
  id: number;
  title: string;
  examType: string;
  subjectId: number | null;
  schoolYearId: number | null;
  institutionId: number | null;
  classId: number | null;
}

export interface CatalogQuery {
  q?: string;
  subjectId?: number;
  schoolYearId?: number;
  institutionId?: number;
  examType?: string;
  page?: number;
  size?: number;
}

export interface CatalogPage<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export function catalogPage(rows: CatalogRow[], query: CatalogQuery): CatalogPage<CatalogRow> {
  const q = query.q?.trim().toLowerCase() || undefined;
  const examType = query.examType?.trim().toLowerCase() || undefined;
  const page = Math.max(0, query.page ?? 0);
  const size = Math.min(100, Math.max(1, query.size ?? 20));
  const content = rows.filter((s) => {
    if (query.subjectId !== undefined && s.subjectId !== query.subjectId) return false;
    if (query.schoolYearId !== undefined && s.schoolYearId !== query.schoolYearId) return false;
    if (query.institutionId !== undefined && s.institutionId !== query.institutionId) return false;
    if (examType !== undefined && (s.examType ?? '').toLowerCase() !== examType) return false;
    if (q !== undefined && !`${s.title} ${s.examType}`.toLowerCase().includes(q)) return false;
    return true;
  });
  return {
    content: content.slice(page * size, page * size + size),
    page,
    size,
    totalElements: content.length,
    totalPages: Math.max(1, Math.ceil(content.length / size)),
  };
}
