/** Which statements a student may open by id, and what the detail screen is allowed to
 *  see. Kept free of `server-only` so `node --test` can cover it, like `catalog-page.ts`.
 *
 *  The visibility rule is the backend's: `StatementService.findByIdVisible` answers
 *  only `visible = true`, and answers 404 for everything else — including an existing
 *  statement the student may not see. Not distinguishing the two is deliberate: which
 *  statements exist is not the student's business. */

export interface DetailRow {
  id: number;
  title: string;
  examType: string;
  subjectId: number | null;
  schoolYearId: number | null;
  institutionId: number | null;
  classId: number | null;
  durationMinutes: number | null;
  totalMaxScore: number | null;
  visible: boolean;
}

export function findVisible(rows: DetailRow[], id: number): DetailRow | null {
  const row = rows.find((r) => r.id === id);
  return row && row.visible ? row : null;
}

/** What `GET /statements/{id}` answers. A StatementSummary: ids, never names, and never
 *  the answer key — the summary has no field for it, and `GET /{id}/full` is the route
 *  that withholds `isCorrect` from a non-editor. */
export function summaryOf(row: DetailRow) {
  return {
    id: row.id,
    title: row.title,
    examType: row.examType,
    durationMinutes: row.durationMinutes,
    variant: null,
    totalMaxScore: row.totalMaxScore,
    visible: row.visible,
    needsReview: null,
    source: 'MANUAL',
    ocrConfidence: null,
    subjectId: row.subjectId,
    schoolYearId: row.schoolYearId,
    institutionId: row.institutionId,
    classId: row.classId,
  };
}

/** `POST /chat/sessions` binds to a statement the caller may read, and `statementId` is
 *  `@NotNull` — there is no such thing as a tutor session without a paper. A session on
 *  a statement the student cannot see is refused, exactly as the read would be. */
export function canOpenChat(rows: DetailRow[], statementId: unknown): boolean {
  if (typeof statementId !== 'number' || !Number.isInteger(statementId)) return false;
  return findVisible(rows, statementId) !== null;
}
