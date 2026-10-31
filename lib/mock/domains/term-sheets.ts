/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
/* eslint-disable @typescript-eslint/no-explicit-any */
import { db, json, problem } from '../store';
import { buildTermSheets, lookupSheet, ownSheets, summaryOf, visibleSheets, type Viewer } from '../term-sheets';
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
  const mine = path === '/api/v1/me/term-sheets' || path === '/api/v1/term-sheets' || /^\/api\/v1\/term-sheets\/[\w.-]+$/.test(path);
  if (!mine) return undefined;
  // As pautas só se lêem aqui: quem as escreve é o motor, por /school-register.
  if (method !== 'GET') return problem(405, 'Method Not Allowed');
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
    const found = lookupSheet(viewer, world(), m[1]);
    if ('status' in found) return problem(found.status, found.status === 404 ? 'Term sheet not found' : 'Teacher is not assigned to this term sheet');
    return json(200, { sheet: summaryOf(found.sheet), rows: found.sheet.rows });
  }
  return undefined;
}
