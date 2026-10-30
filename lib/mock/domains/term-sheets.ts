/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
/* eslint-disable @typescript-eslint/no-explicit-any */
import { db, json, problem } from '../store';
import { buildTermSheets, canReadSheet, ownSheets, summaryOf, visibleSheets, type Viewer } from '../term-sheets';
import type { MockContext } from './auth';

let sheets: ReturnType<typeof buildTermSheets> | null = null;

function world() {
  if (!sheets) {
    const student = db.accounts.find((a) => a.username === '12345');
    const user = db.users.find((u) => u.accountId === student?.id);
    sheets = buildTermSheets({
      classes: db.classes, subjects: db.subjects, studentAccountId: student?.id ?? 0,
      studentName: user ? `${user.firstName} ${user.lastName}` : 'Abner Ede',
    });
  }
  return sheets;
}

function viewerOf(auth: any): Viewer {
  const accountId = Number(auth?.sub);
  const teacher = db.teachers.find((t) => t.accountId === accountId && !t.deletedAt);
  const enrolled = db.enrollments.find((e) => e.accountId === accountId && e.status === 'ACTIVE');
  return { accountId, roles: auth?.roles ?? [], teacherId: teacher?.id ?? null, assignments: db['teaching-assignments'].filter((a) => !a.deletedAt), enrolledClassId: enrolled?.classId ?? null };
}

/** Rotas do domínio «term-sheets» do mock; devolve `undefined` quando o pedido não é deste domínio. */
export async function termSheetRoutes({ method, path, url, auth }: MockContext): Promise<Response | undefined> {
  if (method !== 'GET') return undefined;
  const viewer = viewerOf(auth);

  if (path === '/api/v1/me/term-sheets') return json(200, ownSheets(viewer, world()));

  if (path === '/api/v1/term-sheets') {
    const num = (k: string) => (url.searchParams.get(k) ? Number(url.searchParams.get(k)) : null);
    const [classId, termNumber, subjectId] = [num('classId'), num('termNumber'), num('subjectId')];
    return json(200, visibleSheets(viewer, world())
      .filter((s) => (classId === null || s.classId === classId) && (termNumber === null || s.termNumber === termNumber) && (subjectId === null || s.subjectId === subjectId))
      .map(summaryOf));
  }

  const m = path.match(/^\/api\/v1\/term-sheets\/([\w.-]+)$/);
  if (m) {
    const sheet = world().find((s) => s.sheetId === m[1]);
    if (!sheet) return problem(404, 'Term sheet not found');
    if (!canReadSheet(viewer, sheet)) return problem(403, 'Forbidden');
    return json(200, { ...summaryOf(sheet), rows: sheet.rows });
  }
  return undefined;
}
