import test from 'node:test';
import assert from 'node:assert/strict';
import { addToCurriculum, buildStructure, removeFromCurriculum, subjectOfferings, subjectsOfClass, teacherOverview, validateAssignment, type AcademicWorld } from './academic.ts';

// Duas escolas (ITEL, IMIL); a Helena dá aulas nas duas; Redes está em dois cursos de escolas diferentes.
function world(): AcademicWorld {
  const y = { id: 1, startYear: 2025, endYear: 2026 };
  const itelCourse = { id: 1, institutionId: 1, code: 'TISM', name: 'Informática' };
  const imilCourse = { id: 2, institutionId: 2, code: 'TISM', name: 'Informática (IMIL)' }; // mesmo código, outra escola
  return {
    schoolYears: [y],
    institutions: [{ id: 1, code: 'ITEL', name: 'ITEL' }, { id: 2, code: 'IMIL', name: 'IMIL' }],
    courses: [itelCourse, imilCourse],
    classes: [
      { id: 1, code: '12B', grade: 12, course: itelCourse, schoolYear: y, institutionId: 1 },
      { id: 2, code: '11A', grade: 11, course: itelCourse, schoolYear: y, institutionId: 1 },
      { id: 3, code: '10A', grade: 10, course: imilCourse, schoolYear: y, institutionId: 2 },
    ],
    subjects: [{ id: 1, code: 'RED', name: 'Redes' }, { id: 2, code: 'SO', name: 'Sistemas Operativos' }],
    teachers: [{ id: 1, firstName: 'Helena', lastName: 'Gomes' }, { id: 2, firstName: 'Carlos', lastName: 'Mendes' }],
    courseSubjects: [
      { id: 1, courseId: 1, subjectId: 1, grade: null },
      { id: 2, courseId: 1, subjectId: 2, grade: 12 },
      { id: 3, courseId: 2, subjectId: 1, grade: null },
    ],
    institutionSubjects: [],
    institutionTeachers: [{ institutionId: 1, teacherId: 1 }, { institutionId: 2, teacherId: 1 }, { institutionId: 1, teacherId: 2 }],
    assignments: [],
    enrollments: [],
  };
}

test('a turma herda o currículo do curso para a sua classe', () => {
  const w = world();
  assert.deepEqual(subjectsOfClass(w, w.classes[0]).map((s) => s.code), ['RED', 'SO']); // 12.ª: as duas
  assert.deepEqual(subjectsOfClass(w, w.classes[1]).map((s) => s.code), ['RED']); // 11.ª: SO só da 12.ª
});

test('atribuição exige professor afiliado à escola da turma', () => {
  const w = world();
  assert.equal(validateAssignment(w, { teacherId: 1, classId: 3, subjectId: 1 }), null); // Helena também dá no IMIL
  const p = validateAssignment(w, { teacherId: 2, classId: 3, subjectId: 1 }); // Carlos só no ITEL
  assert.equal(p?.status, 422);
  assert.match(p!.message, /afiliado/);
});

test('atribuição exige disciplina do currículo da turma', () => {
  const w = world();
  const p = validateAssignment(w, { teacherId: 1, classId: 2, subjectId: 2 }); // SO não é da 11.ª
  assert.equal(p?.status, 422);
  assert.match(p!.message, /currículo/);
});

test('adicionar ao currículo é único por curso+classe e afilia a disciplina à escola', () => {
  const w = world();
  let n = 10;
  assert.equal(addToCurriculum(w, 2, 2, null, () => ++n).problem, undefined);
  assert.ok(w.institutionSubjects.some((l) => l.institutionId === 2 && l.subjectId === 2));
  assert.equal(addToCurriculum(w, 2, 2, null, () => ++n).problem?.status, 409);
  assert.equal(addToCurriculum(w, 9, 2, null, () => ++n).problem?.status, 404);
});

test('tirar do currículo falha com atribuições e passa sem elas', () => {
  const w = world();
  w.assignments.push({ id: 1, teacherId: 1, classId: 1, subjectId: 2, schoolYearId: 1 });
  assert.equal(removeFromCurriculum(w, 1, 2)?.status, 409);
  w.assignments.length = 0;
  assert.equal(removeFromCurriculum(w, 1, 2), null);
  assert.equal(subjectsOfClass(w, w.classes[0]).length, 1);
});

test('estrutura da escola: cursos, turmas, disciplinas com professor e avisos', () => {
  const w = world();
  w.assignments.push({ id: 1, teacherId: 1, classId: 1, subjectId: 1, schoolYearId: 1 });
  const s = buildStructure(w, 1)!;
  assert.equal(s.counts.courses, 1);
  assert.equal(s.counts.classes, 2);
  const c12 = s.courses[0].classes.find((k) => k.code === '12B')!;
  assert.equal(c12.subjects.find((x) => x.code === 'RED')!.teachers[0].firstName, 'Helena');
  assert.deepEqual(s.warnings.filter((x) => x.code === 'CLASS_SUBJECT_WITHOUT_TEACHER').map((x) => `${x.classId}:${x.subjectId}`).sort(), ['1:2', '2:1']);
  assert.equal(s.warnings.find((x) => x.code === 'TEACHER_WITHOUT_ASSIGNMENTS')?.teacherId, 2); // Carlos
  assert.equal(buildStructure(w, 99), null);
});

test('curso sem currículo avisa', () => {
  const w = world();
  w.courseSubjects.length = 0;
  assert.ok(buildStructure(w, 1)!.warnings.some((x) => x.code === 'COURSE_WITHOUT_CURRICULUM'));
});

test('professor em duas escolas: visão por escola', () => {
  const w = world();
  w.assignments.push({ id: 1, teacherId: 1, classId: 1, subjectId: 1, schoolYearId: 1 }, { id: 2, teacherId: 1, classId: 3, subjectId: 1, schoolYearId: 1 });
  const o = teacherOverview(w, 1)!;
  assert.deepEqual(o.institutions.map((i) => `${i.code}:${i.assignments.length}`), ['ITEL:1', 'IMIL:1']);
  assert.equal(teacherOverview(w, 2)!.institutions.length, 1);
});

test('disciplina em vários cursos de várias escolas', () => {
  const w = world();
  const o = subjectOfferings(w, 'RED')!;
  assert.deepEqual(o.institutions.map((i) => i.code), ['ITEL', 'IMIL']);
  assert.deepEqual(subjectOfferings(w, 'SO')!.institutions[0].courses[0].classes.map((k) => k.code), ['12B']); // só a 12.ª
  assert.equal(subjectOfferings(w, 'XX'), null);
});
