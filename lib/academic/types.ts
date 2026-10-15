/**
 * Estrutura académica (issue #178): instituição → cursos → turmas → disciplinas → professores.
 * O currículo liga disciplinas a cursos (opcionalmente a uma classe); a turma herda o currículo do curso
 * para a sua classe; o professor é atribuído a (turma, disciplina, ano) e pode dar aulas em várias escolas.
 * Tipos do contrato REST de creative-mode/kixi (V50).
 */

export interface SchoolYearRef { id: number; startYear: number; endYear: number }

/** Entrada do currículo de um curso. `grade` nulo = todas as classes do curso. */
export interface CurriculumEntry {
  linkId: number;
  subjectId: number;
  code: string;
  name: string;
  shortName?: string | null;
  grade: number | null;
}

export interface TeacherRef { id: number; firstName: string; lastName: string }

/** Disciplina dada numa turma, com os professores atribuídos (pode não haver nenhum). */
export interface ClassSubject {
  subjectId: number;
  code: string;
  name: string;
  teachers: (TeacherRef & { assignmentId: number })[];
}

export interface StructureClass {
  id: number;
  code: string;
  grade: number;
  studentCount: number;
  subjects: ClassSubject[];
}

export interface StructureCourse {
  id: number;
  code: string;
  name: string;
  description?: string | null;
  curriculum: CurriculumEntry[];
  classes: StructureClass[];
}

export interface StructureTeacher extends TeacherRef {
  email?: string | null;
  assignments: number;
}

export type WarningCode = 'COURSE_WITHOUT_CURRICULUM' | 'CLASS_SUBJECT_WITHOUT_TEACHER' | 'TEACHER_WITHOUT_ASSIGNMENTS';

export interface StructureWarning {
  code: WarningCode;
  message: string;
  courseId?: number;
  classId?: number;
  subjectId?: number;
  teacherId?: number;
}

export interface InstitutionStructure {
  institution: { id: number; code: string; name: string; short_name?: string | null };
  schoolYear: SchoolYearRef | null;
  courses: StructureCourse[];
  teachers: StructureTeacher[];
  counts: { courses: number; classes: number; subjects: number; teachers: number; students: number };
  warnings: StructureWarning[];
}

/** `GET /teachers/{id}/overview` e `/teachers/me/overview`: onde o professor dá aulas, por escola. */
export interface TeacherOverview {
  teacher: TeacherRef;
  institutions: {
    id: number;
    code: string;
    name: string;
    assignments: {
      assignmentId: number;
      classId: number;
      classCode: string;
      grade: number;
      courseId: number;
      courseName: string;
      subjectId: number;
      subjectCode: string;
      subjectName: string;
      schoolYear: SchoolYearRef;
    }[];
  }[];
}

/** `GET /subjects/{code}/offerings`: onde a disciplina é lecionada. */
export interface SubjectOfferings {
  subject: { id: number; code: string; name: string };
  institutions: {
    id: number;
    code: string;
    name: string;
    courses: { id: number; code: string; name: string; grade: number | null; classes: { id: number; code: string; grade: number }[] }[];
  }[];
}
