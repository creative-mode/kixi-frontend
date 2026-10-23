import test from 'node:test';
import assert from 'node:assert/strict';
import { classChoices, curriculumGroups, mergeCurricula, subjectChoices, type CurriculumChoices } from './curriculum.ts';

const merged = mergeCurricula([
  { classId: 1, subjects: [{ subjectId: 10, name: 'Redes' }, { subjectId: 11, name: 'SO' }] }, // 12B
  { classId: 2, subjects: [{ subjectId: 10, name: 'Redes' }] }, // 11A
]);
const base = (assignments: CurriculumChoices['assignments']): CurriculumChoices => ({
  ...merged, classes: [{ value: 1, label: '12B' }, { value: 2, label: '11A' }], assignments,
});

test('mergeCurricula une as disciplinas e guarda o currículo por turma', () => {
  assert.deepEqual(merged.subjects.map((s) => s.label), ['Redes', 'SO']);
  assert.deepEqual(merged.curriculum, { 1: [10, 11], 2: [10] });
});

test('o administrador vê as disciplinas do currículo da turma escolhida', () => {
  assert.deepEqual(subjectChoices(base(null), 2).map((s) => s.label), ['Redes']);
  assert.deepEqual(subjectChoices(base(null), 1).map((s) => s.label), ['Redes', 'SO']);
  assert.deepEqual(subjectChoices(base(null)).map((s) => s.label), ['Redes', 'SO']);
});

test('as turmas oferecidas são as que têm a disciplina no currículo', () => {
  assert.deepEqual(classChoices(base(null), 11).map((k) => k.label), ['12B']);
  assert.deepEqual(classChoices(base(null), 10).map((k) => k.label), ['12B', '11A']);
  assert.deepEqual(classChoices(base(null)).map((k) => k.label), ['12B', '11A']);
});

test('o professor só vê o que dá, dentro do currículo', () => {
  const t = base([{ classId: 1, subjectId: 10 }, { classId: 2, subjectId: 10 }]);
  assert.deepEqual(subjectChoices(t, 1).map((s) => s.label), ['Redes']); // SO está no currículo mas não é dele
  assert.deepEqual(classChoices(t, 11), []);
  assert.deepEqual(classChoices(t, 10).map((k) => k.label), ['12B', '11A']);
  // atribuição fora do currículo (resíduo antigo) não abre nada
  assert.deepEqual(subjectChoices(base([{ classId: 2, subjectId: 11 }]), 2), []);
});

test('Matemática e Física mostram as turmas cujo currículo as dá; uma disciplina sem currículo não mostra nenhuma', () => {
  const perClass = mergeCurricula([
    { classId: 1, subjects: [{ subjectId: 20, name: 'Matemática' }, { subjectId: 21, name: 'Física' }] }, // 12ª Ciências
    { classId: 2, subjects: [{ subjectId: 20, name: 'Matemática' }] }, // 12ª Humanidades
  ]);
  const c: CurriculumChoices = { ...perClass, classes: [{ value: 1, label: '12ª Ciências' }, { value: 2, label: '12ª Humanidades' }], assignments: null };
  assert.deepEqual(classChoices(c, 20).map((k) => k.label), ['12ª Ciências', '12ª Humanidades']);
  assert.deepEqual(classChoices(c, 21).map((k) => k.label), ['12ª Ciências']);
  // 99 não está em nenhum currículo: não há turma a oferecer, em vez de a escolha ficar por explicar.
  assert.deepEqual(classChoices(c, 99), []);
});

test('curriculumGroups pede o currículo uma vez por curso e classe (#389)', () => {
  const groups = curriculumGroups([
    { id: 1, courseId: 7, grade: 10 },
    { id: 2, courseId: 7, grade: 10 },
    { id: 3, courseId: 7, grade: 11 },
    { id: 4, courseId: 8, grade: 10 },
    { id: 5, courseId: null, grade: 10 },
    { id: 6, courseId: null, grade: 10 },
  ]);
  assert.deepEqual(groups.map((g) => [g.classId, g.classIds]), [[1, [1, 2]], [3, [3]], [4, [4]], [5, [5]], [6, [6]]]);
});
