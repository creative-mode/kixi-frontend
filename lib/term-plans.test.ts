// Testes das regras do plano do trimestre:  node --test lib/term-plans.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { daysText, draftProblem, formatDate, isCleared, planTitle, progress, reminderText, remindersFirst, resizeMac } from './term-plans.ts';
import type { PlanDraft, Reminder } from '../types/term-plans.ts';

const draft = (over: Partial<PlanDraft> = {}): PlanDraft => ({
  classId: 3, subjectId: 1, termId: 1, p1Date: '2026-11-10', p2Date: '2026-12-01', macCount: 2, macDates: ['2026-11-15', '2026-11-22'], macTitles: ['', ''], ...over,
});

test('um plano completo não tem problema; cada falta tem a sua mensagem', () => {
  assert.equal(draftProblem(draft()), null);
  assert.match(draftProblem(draft({ classId: 0 }))!, /turma/);
  assert.match(draftProblem(draft({ termId: 0 }))!, /trimestre/);
  assert.match(draftProblem(draft({ p1Date: '' }))!, /datas/);
  assert.match(draftProblem(draft({ p2Date: '2026-11-01' }))!, /antes da P1/);
  assert.match(draftProblem(draft({ macCount: 11, macDates: [] }))!, /0 a 10/);
  assert.match(draftProblem(draft({ macDates: ['2026-11-15', ''] }))!, /cada avaliação/);
  assert.equal(draftProblem(draft({ macCount: 0, macDates: [], macTitles: [] })), null);
});

test('mudar o número de MAC mantém o que já foi escrito e limita a 0..10', () => {
  const d = draft({ macTitles: ['Teste 1', 'Trabalho'] });
  const more = resizeMac(d, 3);
  assert.deepEqual(more.macDates, ['2026-11-15', '2026-11-22', '']);
  assert.deepEqual(more.macTitles, ['Teste 1', 'Trabalho', '']);
  assert.deepEqual(resizeMac(d, 1).macDates, ['2026-11-15']);
  assert.equal(resizeMac(d, 99).macCount, 10);
  assert.equal(resizeMac(d, -4).macCount, 0);
});

test('datas e prazos lêem-se em português, sem fuso', () => {
  assert.equal(formatDate('2026-11-05'), '05/11/2026');
  assert.equal(daysText(0), 'hoje');
  assert.equal(daysText(1), 'amanhã');
  assert.equal(daysText(6), 'em 6 dias');
  assert.equal(daysText(-1), 'há 1 dia');
  assert.equal(daysText(-3), 'há 3 dias');
});

test('o progresso conta só o que está corrigido ou dispensado', () => {
  const plan = { assessments: [{ status: 'GRADED' }, { status: 'DISPENSED' }, { status: 'ROOM_OPEN' }, { status: 'PLANNED' }] } as never;
  assert.deepEqual(progress(plan), { done: 2, total: 4 });
  assert.equal(isCleared({ status: 'DONE' }), false);
});

test('os lembretes vêm com o atraso primeiro e dizem o que fazer', () => {
  const base = { planId: 1, assessmentId: 1, kind: 'P1', title: 'P1', className: 'A1', subjectName: 'Matemática' } as const;
  const list: Reminder[] = [
    { ...base, assessmentId: 3, plannedDate: '2026-11-20', daysLeft: 12, action: 'OPEN_ROOM', level: 'D14' },
    { ...base, assessmentId: 2, plannedDate: '2026-11-05', daysLeft: -2, action: 'BUILD_STATEMENT', level: 'LATE' },
  ];
  assert.deepEqual(remindersFirst(list).map((r) => r.level), ['LATE', 'D14']);
  assert.equal(reminderText(list[1]), 'Montar o enunciado de P1 (A1 · Matemática), 05/11/2026, há 2 dias.');
  assert.equal(planTitle({ className: 'A1', subjectName: 'Matemática', termNumber: 2 }), 'A1 · Matemática · 2.º trimestre');
});
