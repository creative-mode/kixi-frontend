/**
 * Who may save a statement through `PUT /statements/{id}`, as `StatementService.update`
 * decides it on the backend:
 *
 *   1. `requireAClassForTeachers` — a teacher must name a class (422).
 *   2. `StatementWriteAccessService.checkCanWrite` on the statement as it is now.
 *   3. `InstitutionAccessService.requireCanAuthor` on what the request points at:
 *      the school exists (404), the account is a teacher (403) affiliated with it (403),
 *      the school teaches the subject (422), and the teacher is assigned to that class
 *      and subject (403).
 *
 * Apart from `mock/backend.ts` for the same reason as `gate.ts`: that module imports
 * `server-only`, which `node --test` cannot load, and these are the rules a teacher
 * hits as an error after having reviewed a whole exam.
 */

export interface WriteWorld {
  institutions: { id: number; deletedAt?: string | null }[];
  teachers: { id: number; accountId: number | null; deletedAt?: string | null }[];
  institutionTeachers: { institutionId: number; teacherId: number }[];
  institutionSubjects: { institutionId: number; subjectId: number }[];
  assignments: { teacherId: number; classId: number; subjectId: number; deletedAt?: string | null }[];
}

export interface WriteTarget {
  institutionId: number | null;
  subjectId: number | null;
  classId: number | null;
}

export type WriteProblem = { status: number; message: string };

const forbidden = (message: string): WriteProblem => ({ status: 403, message });

/** `TeachingAssignmentService.requireTeaches`: nothing to check without a class and a subject. */
function teaches(world: WriteWorld, accountId: number, classId: number | null, subjectId: number | null): WriteProblem | null {
  if (classId == null || subjectId == null) return null;
  const teacher = world.teachers.find((t) => t.accountId === accountId && !t.deletedAt);
  if (!teacher) return forbidden('Only teachers can build statements');
  const assigned = world.assignments.some((a) => !a.deletedAt && a.teacherId === teacher.id && a.classId === classId && a.subjectId === subjectId);
  return assigned ? null : forbidden('Teacher is not assigned to this class and subject');
}

/** `StatementWriteAccessService.checkCanWrite`: may this account touch the statement as stored? */
export function canWriteProblem(world: WriteWorld, accountId: number, admin: boolean, stored: WriteTarget): WriteProblem | null {
  if (admin) return null;
  if (stored.institutionId == null) {
    // Os enunciados do OCR chegam sem escola e sem turma: não há nada contra que pesar.
    return stored.classId == null ? null : teaches(world, accountId, stored.classId, stored.subjectId);
  }
  if (stored.classId == null) return forbidden('Only an administrator may change a statement without a class');
  return authorProblem(world, accountId, false, stored);
}

/** `InstitutionAccessService.requireCanAuthor` with the class: may this account point a statement here? */
export function authorProblem(world: WriteWorld, accountId: number, admin: boolean, target: WriteTarget): WriteProblem | null {
  if (!world.institutions.some((i) => i.id === target.institutionId && !i.deletedAt)) return { status: 404, message: 'Institution not found' };
  if (!admin) {
    const teacher = world.teachers.find((t) => t.accountId === accountId && !t.deletedAt);
    if (!teacher) return forbidden('Only teachers can build statements');
    if (!world.institutionTeachers.some((l) => l.institutionId === target.institutionId && l.teacherId === teacher.id)) {
      return forbidden('Teacher is not affiliated with this institution');
    }
  }
  if (!world.institutionSubjects.some((l) => l.institutionId === target.institutionId && l.subjectId === target.subjectId)) {
    return { status: 422, message: 'Subject is not taught by this institution' };
  }
  return admin ? null : teaches(world, accountId, target.classId, target.subjectId);
}

/** The three checks of `StatementService.update`, in its order. */
export function updateProblem(world: WriteWorld, accountId: number, admin: boolean, stored: WriteTarget, request: WriteTarget): WriteProblem | null {
  if (!admin && request.classId == null) {
    return { status: 422, message: 'A teacher must choose the class they teach; only an administrator may build a statement without a class' };
  }
  return canWriteProblem(world, accountId, admin, stored) ?? authorProblem(world, accountId, admin, request);
}
