import type { ClassSubject, CurriculumEntry, StructureTeacher, StructureWarning } from './types.ts';

/** «todas as classes» ou «12.ª classe», para a entrada do currículo. */
export const gradeLabel = (grade: number | null) => (grade == null ? 'todas as classes' : `${grade}.ª classe`);

export const curriculumLabel = (e: Pick<CurriculumEntry, 'name' | 'grade'>) => `${e.name} · ${gradeLabel(e.grade)}`;

/** Disciplinas que ainda se podem pôr no currículo: sem as que já lá estão para todas as classes. */
export function subjectsToAdd<S extends { id: number }>(all: S[], curriculum: Pick<CurriculumEntry, 'subjectId' | 'grade'>[], grade: number | null): S[] {
  const taken = new Set(curriculum.filter((e) => (e.grade ?? null) === (grade ?? null)).map((e) => e.subjectId));
  // «todas as classes» já cobre as classes específicas: não há nada a acrescentar
  const coveredByAll = new Set(curriculum.filter((e) => e.grade == null).map((e) => e.subjectId));
  return all.filter((s) => !taken.has(s.id) && !(grade != null && coveredByAll.has(s.id)));
}

/** Professores da escola que ainda não dão esta disciplina na turma. */
export function teachersToAssign(teachers: StructureTeacher[], subject: Pick<ClassSubject, 'teachers'>): StructureTeacher[] {
  const already = new Set(subject.teachers.map((t) => t.id));
  return teachers.filter((t) => !already.has(t.id));
}

/** Professores de todo o sistema que ainda não estão afiliados a esta escola. */
export function teachersToAffiliate<T extends { id: number }>(all: T[], affiliated: Pick<StructureTeacher, 'id'>[]): T[] {
  const ids = new Set(affiliated.map((t) => t.id));
  return all.filter((t) => !ids.has(t.id));
}

export function warningsOf(warnings: StructureWarning[]) {
  const by = (code: StructureWarning['code']) => warnings.filter((w) => w.code === code);
  return {
    noCurriculum: by('COURSE_WITHOUT_CURRICULUM'),
    noTeacher: by('CLASS_SUBJECT_WITHOUT_TEACHER'),
    idleTeachers: by('TEACHER_WITHOUT_ASSIGNMENTS'),
    total: warnings.length,
  };
}

/** A estrutura está completa quando nenhuma disciplina de turma fica sem professor e nenhum curso sem currículo. */
export const isComplete = (warnings: StructureWarning[]) => warnings.every((w) => w.code === 'TEACHER_WITHOUT_ASSIGNMENTS');

export interface AssignmentLine { classId: number; classCode: string; grade: number; courseName: string; subjectName: string; schoolYear: { startYear: number; endYear: number } }

/** Agrupa as atribuições por turma, para mostrar «12B · Redes, OGI» numa linha. */
export function groupAssignments(items: AssignmentLine[]) {
  const by = new Map<number, { key: number; classCode: string; grade: number; courseName: string; schoolYear: string; subjects: string[] }>();
  for (const a of items) {
    const g = by.get(a.classId) ?? { key: a.classId, classCode: a.classCode, grade: a.grade, courseName: a.courseName, schoolYear: `${a.schoolYear.startYear}–${a.schoolYear.endYear}`, subjects: [] };
    g.subjects.push(a.subjectName);
    by.set(a.classId, g);
  }
  return [...by.values()];
}
