/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
/* eslint-disable @typescript-eslint/no-explicit-any */
import crypto from 'node:crypto';
import { addToCurriculum, buildStructure, removeFromCurriculum, subjectOfferings, subjectsOfClass, teacherOverview } from '../academic';
import { academicWorld, add, db, json, nextId, now, problem } from '../store';
import type { MockContext } from './auth';

/** Rotas do domínio «academic» do mock; devolve `undefined` quando o pedido não é deste domínio. */
export async function academicRoutes({ method, path, url, auth, isStaff, readBody, loginResponse, isAdmin, activeInst, writeWorld, denyWrite }: MockContext): Promise<Response | undefined> {
  let m: RegExpMatchArray | null = null;
  void [m, url, auth, isStaff, readBody, loginResponse, isAdmin, activeInst, writeWorld, denyWrite];
  // ── estrutura académica (V50): currículo, estrutura da escola, visão do professor, onde se leciona ──
  if ((m = path.match(/^\/api\/v1\/courses\/(\d+)\/subjects(?:\/(\d+))?$/))) {
    const cid = Number(m[1]);
    const course = db.courses.find((c) => c.id === cid && !c.deletedAt);
    if (!course) return problem(404, 'Course not found');
    const w = academicWorld();
    if (method === 'GET' && !m[2]) {
      return json(200, w.courseSubjects.filter((l) => l.courseId === cid && !l.deletedAt).map((l) => {
        const sb = db.subjects.find((x) => x.id === l.subjectId);
        return { id: l.id, courseId: cid, subjectId: sb.id, code: sb.code, name: sb.name, shortName: sb.short_name ?? null, grade: l.grade };
      }));
    }
    if (method === 'POST' && !m[2]) {
      const b = readBody();
      if (!b.subjectId) return problem(400, 'The subject is required');
      const r = addToCurriculum(w, cid, Number(b.subjectId), b.grade == null || b.grade === '' ? null : Number(b.grade), () => nextId('courseSubjects'));
      if (r.problem) return problem(r.problem.status, r.problem.message);
      const sb = db.subjects.find((x) => x.id === r.link.subjectId);
      return json(201, { id: r.link.id, courseId: cid, subjectId: sb.id, code: sb.code, name: sb.name, shortName: sb.short_name ?? null, grade: r.link.grade });
    }
    if (method === 'DELETE' && m[2]) {
      const p = removeFromCurriculum(w, cid, Number(m[2]));
      return p ? problem(p.status, p.message) : json(204);
    }
  }
  if ((m = path.match(/^\/api\/v1\/classes\/(\d+)\/subjects$/)) && method === 'GET') {
    const k = db.classes.find((c) => c.id === Number(m[1]) && !c.deletedAt);
    if (!k) return problem(404, 'Class not found');
    const w = academicWorld();
    return json(200, subjectsOfClass(w, k).map((sb) => ({
      subjectId: sb.id, code: sb.code, name: sb.name,
      teachers: db['teaching-assignments'].filter((a) => !a.deletedAt && a.classId === k.id && a.subjectId === sb.id).map((a) => {
        const t = db.teachers.find((x) => x.id === a.teacherId);
        return { id: t.id, firstName: t.firstName, lastName: t.lastName, assignmentId: a.id };
      }),
    })));
  }
  if ((m = path.match(/^\/api\/v1\/institutions\/(\d+)\/structure$/)) && method === 'GET') {
    const yr = url.searchParams.get('schoolYearId');
    const st = buildStructure(academicWorld(), Number(m[1]), yr ? Number(yr) : null);
    return st ? json(200, st) : problem(404, 'Institution not found');
  }
  if (path === '/api/v1/teachers/me/overview' && method === 'GET') {
    const t = db.teachers.find((x) => x.accountId === Number(auth.sub) && !x.deletedAt);
    return t ? json(200, teacherOverview(academicWorld(), t.id)) : problem(404, 'Teacher not found');
  }
  if ((m = path.match(/^\/api\/v1\/teachers\/(\d+)\/overview$/)) && method === 'GET') {
    const o = teacherOverview(academicWorld(), Number(m[1]));
    return o ? json(200, o) : problem(404, 'Teacher not found');
  }
  if ((m = path.match(/^\/api\/v1\/subjects\/([^/]+)\/offerings$/)) && method === 'GET') {
    const o = subjectOfferings(academicWorld(), decodeURIComponent(m[1]));
    return o ? json(200, o) : problem(404, 'Subject not found');
  }
  // só escolas com turmas no ano (onboarding do aluno)
  if (path === '/api/v1/institutions' && method === 'GET' && url.searchParams.has('onlyWithClassesInYear')) {
    const y = Number(url.searchParams.get('onlyWithClassesInYear'));
    const ids = new Set(db.classes.filter((c) => !c.deletedAt && c.schoolYear?.id === y).map((c) => c.institutionId));
    return json(200, db.institutions.filter((i) => !i.deletedAt && ids.has(i.id)));
  }

  // ── turmas por escola/curso (ClassController: ?institutionId=&courseId=) ──
  if (path === '/api/v1/classes' && method === 'GET' && (url.searchParams.has('institutionId') || url.searchParams.has('courseId'))) {
    const inst = url.searchParams.get('institutionId');
    const course = url.searchParams.get('courseId');
    return json(200, db.classes.filter((c) => !c.deletedAt && (!inst || c.institutionId === Number(inst)) && (!course || c.course?.id === Number(course))));
  }
  // ── as atribuições do professor com sessão (TeachingAssignmentController.listMine) ──
  if (path === '/api/v1/teaching-assignments/me' && method === 'GET') {
    const t = db.teachers.find((x) => x.accountId === Number(auth.sub) && !x.deletedAt);
    return json(200, t ? db['teaching-assignments'].filter((a) => !a.deletedAt && a.teacherId === t.id) : []);
  }

  // ── o estilo do tutor de uma atribuição (TeachingAssignmentController.updateTutorStyle, kixi#206) ──
  m = path.match(/^\/api\/v1\/teaching-assignments\/(\d+)\/tutor-style$/);
  if (m && method === 'PUT') {
    const a = db['teaching-assignments'].find((x) => x.id === Number(m[1]) && !x.deletedAt);
    if (!a) return problem(404, 'Teaching assignment not found');
    const admin = (auth?.roles ?? []).includes('ADMIN');
    const t = db.teachers.find((x) => x.id === a.teacherId && !x.deletedAt);
    if (!admin && (!t || t.accountId !== Number(auth.sub))) return problem(403, 'Only the assigned teacher or ADMIN can change this tutor style');
    const raw = readBody().tutorStyle;
    const style = typeof raw === 'string' && raw.trim() ? raw.trim() : null;
    if (style && style.length > 100) return problem(400, 'The tutor style must not exceed 100 characters');
    a.tutorStyle = style;
    return json(200, a);
  }

  // ── teaching-assignments/me: como no backend, só as atribuições da conta.
  if (path === '/api/v1/teaching-assignments/me' && method === 'GET') {
    const t = db.teachers.find((x) => x.accountId === Number(auth.sub) && !x.deletedAt);
    if (!t) return json(200, []);
    return json(200, db['teaching-assignments'].filter((a) => !a.deletedAt && a.teacherId === t.id));
  }

  // ── códigos de matrícula (#255): ADMIN emite, lista por turma e revoga. ──
  if ((m = path.match(/^\/api\/v1\/enrollment-codes(?:\/(\d+))?$/))) {
    if (!(auth?.roles ?? []).includes('ADMIN')) return problem(403, 'Only ADMIN can manage enrollment codes');
    const codeOut = (c: any) => ({
      id: c.id, code: c.code, classId: c.classId, maxUses: c.maxUses, uses: c.uses,
      expiresAt: c.expiresAt, revokedAt: c.revokedAt, createdAt: c.createdAt,
    });
    if (!m[1] && method === 'POST') {
      const b = readBody();
      const classId = Number(b.classId);
      if (!Number.isInteger(classId) || classId < 1) return problem(400, 'Class is required');
      if (!db.classes.find((c: any) => c.id === classId && !c.deletedAt)) return problem(404, 'Class not found');
      const maxUses = b.maxUses == null ? 1 : Number(b.maxUses);
      if (!Number.isInteger(maxUses) || maxUses < 1) return problem(400, 'maxUses must be at least 1');
      let expiresAt: string | null = null;
      if (b.expiresAt != null && b.expiresAt !== '') {
        const when = new Date(String(b.expiresAt));
        if (Number.isNaN(when.getTime()) || when <= new Date()) return problem(400, 'expiresAt must be in the future');
        expiresAt = String(b.expiresAt);
      }
      // Mesmo alfabeto do EnrollmentCodeService: sem O/0 nem I/1/L, que se confundem.
      const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
      for (let attempt = 0; attempt < 5; attempt++) {
        const code = Array.from({ length: 8 }, () => alphabet[crypto.randomInt(alphabet.length)]).join('');
        if (db.enrollmentCodes.some((c: any) => c.code === code)) continue;
        const row = add('enrollmentCodes', { code, classId, maxUses, uses: 0, expiresAt, revokedAt: null });
        return json(201, codeOut(row));
      }
      return problem(503, 'Could not generate a unique enrollment code');
    }
    if (!m[1] && method === 'GET') {
      const classId = Number(url.searchParams.get('classId'));
      if (!Number.isInteger(classId) || classId < 1) return problem(400, 'classId is required');
      return json(200, db.enrollmentCodes.filter((c: any) => c.classId === classId).sort((a: any, b: any) => b.id - a.id).map(codeOut));
    }
    if (m[1] && method === 'DELETE') {
      const row = db.enrollmentCodes.find((c: any) => c.id === Number(m[1]));
      if (!row) return problem(404, 'Enrollment code not found');
      if (!row.revokedAt) row.revokedAt = now();
      return json(200, codeOut(row));
    }
  }

  return undefined;
}
