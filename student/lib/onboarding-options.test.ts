import test from 'node:test';
import assert from 'node:assert/strict';
import { onboardingOptions } from './onboarding-options.ts';

const courses = [{ id: 1 }, { id: 2 }];
const classes = [
  { id: 10, course: { id: 1 }, schoolYear: { id: 5 } },
  { id: 11, course: { id: 1 }, schoolYear: { id: 4 } }, // ano passado
  { id: 12, course: { id: 2 }, schoolYear: { id: 4 } }, // curso só com turmas do ano passado
];

test('só cursos com turmas no ano atual', () => {
  assert.deepEqual(onboardingOptions(courses, classes, 5, null).courses, [{ id: 1 }]);
});
test('só as turmas do curso e do ano', () => {
  assert.deepEqual(onboardingOptions(courses, classes, 5, 1).classes.map((k) => k.id), [10]);
  assert.deepEqual(onboardingOptions(courses, classes, 5, 2).classes, []);
});
test('sem ano letivo não há nada para oferecer', () => {
  assert.deepEqual(onboardingOptions(courses, classes, null, 1), { courses: [], classes: [] });
});
