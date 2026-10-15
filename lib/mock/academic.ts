// Regras da estrutura académica do mock (espelham o backend, V50). Puras, sem Next nem estado global,
// para se testarem em isolamento. O mock passa-lhes as tabelas por `world`.
import type { InstitutionStructure, StructureCourse, StructureWarning, SubjectOfferings, TeacherOverview } from '../academic/types.ts';

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface AcademicWorld {
  institutions: any[];
  courses: any[];
  classes: any[];
  subjects: any[];
  teachers: any[];
  courseSubjects: { id: number; courseId: number; subjectId: number; grade: number | null; deletedAt?: string | null }[];
  institutionSubjects: { institutionId: number; subjectId: number }[];
  institutionTeachers: { institutionId: number; teacherId: number }[];
  assignments: any[];
  enrollments: any[];
  schoolYears: any[];
}

export interface Problem { status: number; message: string }

const live = <T extends { deletedAt?: string | null }>(rows: T[]) => rows.filter((r) => !r.deletedAt);

export function curriculumOfCourse(w: AcademicWorld, courseId: number) {
  return live(w.courseSubjects)
    .filter((l) => l.courseId === courseId)
    .map((l) => ({ link: l, subject: w.subjects.find((s) => s.id === l.subjectId && !s.deletedAt) }))
    .filter((x) => x.subject);
}

/** Disciplinas que uma turma dá: o currículo do curso que vale para a sua classe. */
export function subjectsOfClass(w: AcademicWorld, cls: { course?: { id: number } | null; grade: number }) {
  const seen = new Set<number>();
  const out: any[] = [];
  for (const { link, subject } of curriculumOfCourse(w, cls.course?.id ?? -1)) {
    if (link.grade != null && link.grade !== cls.grade) continue;
    if (seen.has(subject.id)) continue;
    seen.add(subject.id);
    out.push(subject);
  }
  return out;
}

/** O professor só é atribuído a uma turma da escola a que está afiliado, numa disciplina do currículo dela. */
export function validateAssignment(w: AcademicWorld, b: { teacherId: number; classId: number; subjectId: number }): Problem | null {
  const cls = w.classes.find((c) => c.id === Number(b.classId) && !c.deletedAt);
  if (!cls) return null; // a existência valida-se à parte (404)
  const inst = cls.institutionId ?? cls.course?.institutionId;
  if (!w.institutionTeachers.some((l) => l.institutionId === inst && l.teacherId === Number(b.teacherId))) {
    return { status: 422, message: 'O professor não está afiliado à escola desta turma.' };
  }
  if (!subjectsOfClass(w, cls).some((s) => s.id === Number(b.subjectId))) {
    return { status: 422, message: 'A disciplina não faz parte do currículo do curso desta turma.' };
  }
  return null;
}

export function addToCurriculum(w: AcademicWorld, courseId: number, subjectId: number, grade: number | null, nextId: () => number): { problem?: Problem; link?: any } {
  const course = w.courses.find((c) => c.id === courseId && !c.deletedAt);
  if (!course) return { problem: { status: 404, message: 'Curso não encontrado.' } };
  const subject = w.subjects.find((s) => s.id === subjectId && !s.deletedAt);
  if (!subject) return { problem: { status: 404, message: 'Disciplina não encontrada.' } };
  if (live(w.courseSubjects).some((l) => l.courseId === courseId && l.subjectId === subjectId && (l.grade ?? null) === (grade ?? null))) {
    return { problem: { status: 409, message: 'Esta disciplina já está no currículo do curso.' } };
  }
  const link = { id: nextId(), courseId, subjectId, grade: grade ?? null, deletedAt: null };
  w.courseSubjects.push(link);
  // a escola passa a ter a disciplina no seu catálogo (é o que o backend faz ao ligá-la ao curso)
  if (!w.institutionSubjects.some((l) => l.institutionId === course.institutionId && l.subjectId === subjectId)) {
    w.institutionSubjects.push({ institutionId: course.institutionId, subjectId });
  }
  return { link };
}

/** Tirar uma disciplina do currículo falha enquanto houver professores atribuídos nas turmas que a dão. */
export function removeFromCurriculum(w: AcademicWorld, courseId: number, linkId: number): Problem | null {
  const link = live(w.courseSubjects).find((l) => l.id === linkId && l.courseId === courseId);
  if (!link) return { status: 404, message: 'Entrada do currículo não encontrada.' };
  const others = live(w.courseSubjects).filter((l) => l.courseId === courseId && l.subjectId === link.subjectId && l.id !== linkId);
  const classes = live(w.classes).filter((c) => c.course?.id === courseId && (link.grade == null || c.grade === link.grade));
  const stillCovered = (c: any) => others.some((o) => o.grade == null || o.grade === c.grade);
  const used = classes.some((c) => !stillCovered(c) && live(w.assignments).some((a) => a.classId === c.id && a.subjectId === link.subjectId));
  if (used) return { status: 409, message: 'Há professores atribuídos a esta disciplina neste curso. Retire as atribuições primeiro.' };
  link.deletedAt = new Date().toISOString().slice(0, 19);
  return null;
}

export function buildStructure(w: AcademicWorld, institutionId: number, schoolYearId?: number | null): InstitutionStructure | null {
  const inst = w.institutions.find((i) => i.id === institutionId && !i.deletedAt);
  if (!inst) return null;
  const year = (schoolYearId != null ? w.schoolYears.find((y) => y.id === schoolYearId) : [...w.schoolYears].sort((a, b) => b.startYear - a.startYear)[0]) ?? null;
  const warnings: StructureWarning[] = [];
  const teacherName = (t: any) => `${t.firstName} ${t.lastName}`;
  const courses: StructureCourse[] = live(w.courses)
    .filter((c) => c.institutionId === institutionId)
    .map((c) => {
      const curriculum = curriculumOfCourse(w, c.id).map(({ link, subject }) => ({
        linkId: link.id, subjectId: subject.id, code: subject.code, name: subject.name, shortName: subject.short_name ?? null, grade: link.grade,
      }));
      if (curriculum.length === 0) warnings.push({ code: 'COURSE_WITHOUT_CURRICULUM', courseId: c.id, message: `O curso ${c.code} ainda não tem disciplinas no currículo.` });
      const classes = live(w.classes)
        .filter((k) => k.course?.id === c.id && (!year || k.schoolYear?.id === year.id))
        .map((k) => ({
          id: k.id, code: k.code, grade: k.grade,
          studentCount: live(w.enrollments).filter((e) => e.classId === k.id && e.status !== 'CANCELLED').length,
          subjects: subjectsOfClass(w, k).map((s) => {
            const teachers = live(w.assignments)
              .filter((a) => a.classId === k.id && a.subjectId === s.id)
              .map((a) => ({ a, t: w.teachers.find((t) => t.id === a.teacherId && !t.deletedAt) }))
              .filter((x) => x.t)
              .map(({ a, t }) => ({ id: t.id, firstName: t.firstName, lastName: t.lastName, assignmentId: a.id }));
            if (teachers.length === 0) warnings.push({ code: 'CLASS_SUBJECT_WITHOUT_TEACHER', classId: k.id, subjectId: s.id, message: `${s.name} na turma ${k.code} não tem professor.` });
            return { subjectId: s.id, code: s.code, name: s.name, teachers };
          }),
        }));
      return { id: c.id, code: c.code, name: c.name, description: c.description ?? null, curriculum, classes };
    });
  const classIds = new Set(courses.flatMap((c) => c.classes.map((k) => k.id)));
  const teachers = w.institutionTeachers
    .filter((l) => l.institutionId === institutionId)
    .map((l) => w.teachers.find((t) => t.id === l.teacherId && !t.deletedAt))
    .filter(Boolean)
    .map((t: any) => {
      const mine = live(w.assignments).filter((a) => a.teacherId === t.id && classIds.has(a.classId)).length;
      if (mine === 0) warnings.push({ code: 'TEACHER_WITHOUT_ASSIGNMENTS', teacherId: t.id, message: `${teacherName(t)} ainda não tem turmas nesta escola.` });
      return { id: t.id, firstName: t.firstName, lastName: t.lastName, email: t.email ?? null, assignments: mine };
    });
  const subjectIds = new Set(courses.flatMap((c) => c.curriculum.map((e) => e.subjectId)));
  return {
    institution: { id: inst.id, code: inst.code, name: inst.name, short_name: inst.short_name ?? null },
    schoolYear: year ? { id: year.id, startYear: year.startYear, endYear: year.endYear } : null,
    courses, teachers,
    counts: {
      courses: courses.length, classes: classIds.size, subjects: subjectIds.size, teachers: teachers.length,
      students: courses.reduce((n, c) => n + c.classes.reduce((m, k) => m + k.studentCount, 0), 0),
    },
    warnings,
  };
}

export function teacherOverview(w: AcademicWorld, teacherId: number): TeacherOverview | null {
  const t = w.teachers.find((x) => x.id === teacherId && !x.deletedAt);
  if (!t) return null;
  const byInst = new Map<number, TeacherOverview['institutions'][number]>();
  // escolas a que está afiliado aparecem mesmo sem atribuições
  for (const l of w.institutionTeachers.filter((x) => x.teacherId === teacherId)) {
    const i = w.institutions.find((x) => x.id === l.institutionId && !x.deletedAt);
    if (i) byInst.set(i.id, { id: i.id, code: i.code, name: i.name, assignments: [] });
  }
  for (const a of live(w.assignments).filter((x) => x.teacherId === teacherId)) {
    const k = w.classes.find((c) => c.id === a.classId && !c.deletedAt);
    const s = w.subjects.find((x) => x.id === a.subjectId);
    const y = w.schoolYears.find((x) => x.id === a.schoolYearId);
    const entry = k ? byInst.get(k.institutionId) : null;
    if (!k || !s || !y || !entry) continue;
    entry.assignments.push({
      assignmentId: a.id, classId: k.id, classCode: k.code, grade: k.grade, courseId: k.course.id, courseName: k.course.name,
      subjectId: s.id, subjectCode: s.code, subjectName: s.name, schoolYear: { id: y.id, startYear: y.startYear, endYear: y.endYear },
    });
  }
  return { teacher: { id: t.id, firstName: t.firstName, lastName: t.lastName }, institutions: [...byInst.values()] };
}

export function subjectOfferings(w: AcademicWorld, subjectCode: string): SubjectOfferings | null {
  const s = w.subjects.find((x) => x.code === subjectCode && !x.deletedAt);
  if (!s) return null;
  const byInst = new Map<number, SubjectOfferings['institutions'][number]>();
  for (const l of live(w.courseSubjects).filter((x) => x.subjectId === s.id)) {
    const c = w.courses.find((x) => x.id === l.courseId && !x.deletedAt);
    const i = c ? w.institutions.find((x) => x.id === c.institutionId && !x.deletedAt) : null;
    if (!c || !i) continue;
    const entry: SubjectOfferings['institutions'][number] = byInst.get(i.id) ?? { id: i.id, code: i.code, name: i.name, courses: [] };
    byInst.set(i.id, entry);
    const classes = live(w.classes).filter((k) => k.course?.id === c.id && (l.grade == null || k.grade === l.grade)).map((k) => ({ id: k.id, code: k.code, grade: k.grade }));
    entry.courses.push({ id: c.id, code: c.code, name: c.name, grade: l.grade, classes });
  }
  return { subject: { id: s.id, code: s.code, name: s.name }, institutions: [...byInst.values()] };
}
