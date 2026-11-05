import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildStudyPlan, daysLabelOf } from './study-plan-rules.ts';
import { parseServerTime } from './exam-rules.ts';
import type { Invitation } from './exam-room-rules.ts';
import type { Performance } from './performance-rules.ts';

const base = {
  accountId: 3,
  simulationId: null,
  joinedAt: null,
  statementId: 1,
  durationMinutes: 45,
  simulationStatus: null,
  serverTime: '2026-10-31T09:00:00',
};

const inv = (over: Partial<Invitation>): Invitation => ({ ...base, roomId: 1, statementTitle: 'Física, 2.º trimestre', status: 'DRAFT', startsAt: '2026-11-06T08:00:00', endsAt: '2026-11-06T09:00:00', ...over });

const now = parseServerTime('2026-10-31T09:00:00');

const emptyPerformance: Performance = { mastery: [], activity: [] };

test('sem nenhuma sala por abrir não há plano', () => {
  assert.equal(buildStudyPlan([], emptyPerformance, now), null);
  assert.equal(buildStudyPlan([inv({ status: 'CLOSED' })], emptyPerformance, now), null);
});

test('sem nenhuma tentativa ainda, o diagnóstico fica "a fazer" e o treino não avança', () => {
  const plan = buildStudyPlan([inv({})], emptyPerformance, now);
  assert.ok(plan);
  assert.equal(plan.steps[0].status, 'current');
  assert.equal(plan.steps[0].href, null);
  assert.equal(plan.steps[1].status, 'future');
  assert.equal(plan.steps[2].status, 'future');
  assert.equal(plan.steps[3].title, 'Física, 2.º trimestre');
});

test('com uma tentativa feita, o diagnóstico fica "feito" e o treino do tema mais fraco é o passo atual', () => {
  const performance: Performance = {
    mastery: [{ id: 9, label: 'Lei de Ohm', value: 42 }, { id: 10, label: 'Cinemática', value: 80 }],
    activity: [{ id: 5, title: 'Diagnóstico de Física', score: 11, finishedAt: '2026-10-30T10:00:00' }],
  };
  const plan = buildStudyPlan([inv({})], performance, now);
  assert.ok(plan);
  assert.equal(plan.steps[0].status, 'done');
  assert.equal(plan.steps[0].href, '/resultado?prova=5');
  assert.equal(plan.steps[1].status, 'current');
  assert.equal(plan.steps[1].title, 'Treinar Lei de Ohm');
  assert.equal(plan.steps[1].href, '/tutor?statementId=9');
});

test('a contagem de dias fala em calendário, não em horas exatas', () => {
  assert.equal(daysLabelOf('2026-10-31T23:00:00', now), 'Hoje');
  assert.equal(daysLabelOf('2026-11-01T01:00:00', now), 'Amanhã');
  assert.equal(daysLabelOf('2026-11-06T08:00:00', now), 'Daqui a 6 dias');
});
