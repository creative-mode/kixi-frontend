import test from 'node:test';
import assert from 'node:assert/strict';
import { curriculumLabel, gradeLabel, groupAssignments, warningText, isComplete, subjectsToAdd, teachersToAffiliate, teachersToAssign, warningsOf } from './structure.ts';

test('rótulos do currículo', () => {
  assert.equal(gradeLabel(null), 'todas as classes');
  assert.equal(curriculumLabel({ name: 'Redes', grade: 12 }), 'Redes · 12.ª classe');
});

test('subjectsToAdd tira o que já está no currículo e o que «todas as classes» já cobre', () => {
  const all = [{ id: 1 }, { id: 2 }, { id: 3 }];
  const cur = [{ subjectId: 1, grade: null }, { subjectId: 2, grade: 12 }];
  assert.deepEqual(subjectsToAdd(all, cur, null).map((s) => s.id), [2, 3]); // 2 só para a 12.ª: ainda se pode pôr em todas
  assert.deepEqual(subjectsToAdd(all, cur, 12).map((s) => s.id), [3]); // 1 está em todas, 2 já está na 12.ª
  assert.deepEqual(subjectsToAdd(all, cur, 11).map((s) => s.id), [2, 3]);
});

test('professores a atribuir e a afiliar', () => {
  const teachers = [{ id: 1, firstName: 'A', lastName: 'B', assignments: 0 }, { id: 2, firstName: 'C', lastName: 'D', assignments: 1 }];
  assert.deepEqual(teachersToAssign(teachers, { teachers: [{ id: 1, firstName: 'A', lastName: 'B', assignmentId: 9 }] }).map((t) => t.id), [2]);
  assert.deepEqual(teachersToAffiliate([{ id: 1 }, { id: 2 }, { id: 3 }], teachers).map((t) => t.id), [3]);
});

test('avisos agrupados e completude', () => {
  const w = [
    { code: 'COURSE_WITHOUT_CURRICULUM', message: 'x' },
    { code: 'TEACHER_WITHOUT_ASSIGNMENTS', message: 'y' },
  ] as const;
  const g = warningsOf([...w]);
  assert.equal(g.noCurriculum.length, 1);
  assert.equal(g.total, 2);
  assert.equal(isComplete([...w]), false);
  assert.equal(isComplete([w[1]]), true);
  assert.equal(isComplete([]), true);
});

test('groupAssignments junta as disciplinas por turma', () => {
  const y = { startYear: 2025, endYear: 2026 };
  const g = groupAssignments([
    { classId: 1, classCode: '12B', grade: 12, courseName: 'Info', subjectName: 'Redes', schoolYear: y },
    { classId: 1, classCode: '12B', grade: 12, courseName: 'Info', subjectName: 'OGI', schoolYear: y },
    { classId: 2, classCode: '11A', grade: 11, courseName: 'Info', subjectName: 'Redes', schoolYear: y },
  ]);
  assert.deepEqual(g.map((x) => [x.classCode, x.subjects]), [['12B', ['Redes', 'OGI']], ['11A', ['Redes']]]);
  assert.equal(g[0].schoolYear, '2025–2026');
});

test('warningText compõe o português a partir do code e das referências', () => {
  const s = {
    courses: [{ id: 1, code: 'TISM', name: 'Info', curriculum: [], classes: [{ id: 7, code: '10A', grade: 10, studentCount: 0, subjects: [{ subjectId: 3, code: 'FIS', name: 'Física', teachers: [] }] }] }],
    teachers: [{ id: 9, firstName: 'Ana', lastName: 'Lopes', assignments: 0 }],
  };
  assert.equal(warningText({ code: 'COURSE_WITHOUT_CURRICULUM', message: 'The course TISM has no subjects', courseId: 1 }, s), 'O curso TISM ainda não tem disciplinas no currículo.');
  assert.equal(warningText({ code: 'CLASS_SUBJECT_WITHOUT_TEACHER', message: 'The subject FIS of class 10A has no teacher', classId: 7, subjectId: 3 }, s), 'Física na turma 10A ainda não tem professor.');
  assert.equal(warningText({ code: 'TEACHER_WITHOUT_ASSIGNMENTS', message: 'x', teacherId: 9 }, s), 'Ana Lopes está afiliado mas ainda não dá nenhuma disciplina.');
  assert.equal(warningText({ code: 'TEACHER_WITHOUT_ASSIGNMENTS', message: 'x', teacherId: 99 }, s), 'Um professor está afiliado mas ainda não dá nenhuma disciplina.');
});
