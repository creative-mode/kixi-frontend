import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateScoreBreakdown, type ResultQuestion } from './result-rules';

function q(overrides: Partial<ResultQuestion> = {}): ResultQuestion {
  return {
    questionId: 1,
    number: 1,
    text: 'Pergunta',
    options: [],
    maxScore: 2,
    scoreObtained: 2,
    isCorrect: true,
    ...overrides,
  };
}

function obj(overrides: Partial<ResultQuestion> = {}): ResultQuestion {
  return q({ options: [{ id: 1, optionText: 'A', isCorrect: true }], ...overrides });
}

test('calculateScoreBreakdown: only objective questions', () => {
  const questions = [obj({ maxScore: 2, scoreObtained: 2 }), obj({ maxScore: 2, scoreObtained: 0 })];
  const b = calculateScoreBreakdown(questions);
  assert.equal(b.objectiveScore, 2);
  assert.equal(b.objectiveMax, 4);
  assert.equal(b.openScore, 0);
  assert.equal(b.openMax, 0);
  assert.equal(b.openPendingScore, 0);
  assert.equal(b.openPendingMax, 0);
  assert.equal(b.hasAiGraded, false);
  assert.equal(b.hasSchoolOpsGraded, false);
});

test('calculateScoreBreakdown: objective + open graded by AI', () => {
  const questions = [
    obj({ maxScore: 2, scoreObtained: 2 }),
    q({ maxScore: 4, scoreObtained: 3, aiLevel: 'PARCIAL', aiFeedback: 'OK' }),
  ];
  const b = calculateScoreBreakdown(questions);
  assert.equal(b.objectiveScore, 2);
  assert.equal(b.objectiveMax, 2);
  assert.equal(b.openScore, 3);
  assert.equal(b.openMax, 4);
  assert.equal(b.openPendingScore, 0);
  assert.equal(b.openPendingMax, 0);
  assert.equal(b.hasAiGraded, true);
  assert.equal(b.hasSchoolOpsGraded, false);
});

test('calculateScoreBreakdown: open questions pending (no score)', () => {
  const questions = [
    obj({ maxScore: 2, scoreObtained: 2 }),
    q({ maxScore: 4, scoreObtained: null, isCorrect: null }),
  ];
  const b = calculateScoreBreakdown(questions);
  assert.equal(b.objectiveScore, 2);
  assert.equal(b.objectiveMax, 2);
  assert.equal(b.openScore, 0);
  assert.equal(b.openMax, 0);
  assert.equal(b.openPendingScore, 0);
  assert.equal(b.openPendingMax, 4);
  assert.equal(b.hasAiGraded, false);
  assert.equal(b.hasSchoolOpsGraded, false);
});

test('calculateScoreBreakdown: mixed graded and pending open', () => {
  const questions = [
    obj({ maxScore: 2, scoreObtained: 2 }),
    q({ maxScore: 4, scoreObtained: 3, aiLevel: 'TOTAL' }),
    q({ maxScore: 4, scoreObtained: null }),
  ];
  const b = calculateScoreBreakdown(questions);
  assert.equal(b.openScore, 3);
  assert.equal(b.openMax, 4);
  assert.equal(b.openPendingScore, 0);
  assert.equal(b.openPendingMax, 4);
  assert.equal(b.hasAiGraded, true);
});

test('calculateScoreBreakdown: SchoolOps graded (feedback but no aiLevel)', () => {
  const questions = [
    obj({ maxScore: 2, scoreObtained: 2 }),
    q({ maxScore: 4, scoreObtained: 3, feedback: 'Bem', isCorrect: true }),
  ];
  const b = calculateScoreBreakdown(questions);
  assert.equal(b.hasAiGraded, false);
  assert.equal(b.hasSchoolOpsGraded, true);
});

test('calculateScoreBreakdown: maxScore null treated as 0', () => {
  const questions = [obj({ maxScore: null, scoreObtained: 2 })];
  const b = calculateScoreBreakdown(questions);
  assert.equal(b.objectiveMax, 0);
  assert.equal(b.objectiveScore, 2);
});

test('calculateScoreBreakdown: empty questions', () => {
  const b = calculateScoreBreakdown([]);
  assert.equal(b.objectiveScore, 0);
  assert.equal(b.objectiveMax, 0);
  assert.equal(b.openScore, 0);
  assert.equal(b.openMax, 0);
});

test('calculateScoreBreakdown: undefined questions', () => {
  const b = calculateScoreBreakdown(undefined);
  assert.equal(b.objectiveScore, 0);
  assert.equal(b.objectiveMax, 0);
});
