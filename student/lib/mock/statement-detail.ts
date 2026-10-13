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
  durationMinutes: number | null;
  totalMaxScore: number | null;
  variant?: string | null;
  visible: boolean;
  needsReview?: boolean;
  ocrConfidence?: number | null;
  source?: 'MANUAL' | 'OCR';
  termId?: number | null;
  subjectId?: number | null;
  schoolYearId?: number | null;
  institutionId?: number | null;
  classId?: number | null;
}

export function findVisible(rows: DetailRow[], id: number): DetailRow | null {
  const row = rows.find((r) => r.id === id);
  return row && row.visible ? row : null;
}

/** What `GET /statements/{id}` answers. A StatementSummary: ids, never names, and never
 *  the answer key — the summary has no field for it, and `GET /{id}/full` is the route
 *  that withholds `isCorrect` from a non-editor. */
/**
 * What `GET /statements/{id}` answers: the StatementSummary, ids only and never the
 * answer key — the summary has no field for it, and `GET /{id}/full` is the route that
 * withholds `isCorrect` from a non-editor.
 *
 * `needsReview` and `ocrConfidence` travel as the backend sends them. O mock escondia-os
 * aos alunos e o teste confirmava isso, o que era mais um sítio onde o mock e o backend
 * discordavam: só `StatementOcrResponse.from`, que é a rota `/full`, esconde o
 * `ocrConfidence` — o summary devolve o valor real.
 */
export function summaryOf(row: DetailRow) {
  return {
    id: row.id,
    title: row.title,
    examType: row.examType,
    durationMinutes: row.durationMinutes,
    variant: row.variant ?? null,
    totalMaxScore: row.totalMaxScore,
    visible: row.visible,
    needsReview: row.needsReview ?? null,
    source: row.source ?? 'MANUAL',
    ocrConfidence: row.ocrConfidence ?? null,
    schoolYearId: row.schoolYearId ?? null,
    termId: row.termId ?? null,
    subjectId: row.subjectId ?? null,
    institutionId: row.institutionId ?? null,
    classId: row.classId ?? null,
  };
}
