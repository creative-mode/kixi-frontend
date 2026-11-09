// node --test lib/training.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { clampCount, levelLabel, masteryOf, picksOf, presetCounts, sourcesLabel, summarize, valuesLabel, type PlanItem } from './training.ts';

/** Prepara-te para a prova: as regras do ecrã que monta o treino a partir da matriz do professor. */

const item = (extra: Partial<PlanItem> = {}): PlanItem => ({
  topicId: 1, name: 'Sub-redes', questionCount: 3, points: 6, cognitiveLevel: 'APPLICATION',
  available: 10, sources: [], attempted: 0, correct: 0, ...extra,
});

test('nunca se pede mais do que há, nem menos que zero', () => {
  assert.equal(clampCount(12, item({ available: 5 })), 5);
  assert.equal(clampCount(-2, item()), 0);
  assert.equal(clampCount(Number.NaN, item()), 0);
  assert.equal(clampCount(2.9, item()), 2);
});

test('«como na prova» copia a matriz; o dobro fica limitado pelo banco', () => {
  const items = [item({ topicId: 1, questionCount: 3, available: 10 }), item({ topicId: 2, questionCount: 4, available: 5 })];
  assert.deepEqual(presetCounts(items, 'prova'), { 1: 3, 2: 4 });
  assert.deepEqual(presetCounts(items, 'dobro'), { 1: 6, 2: 5 });
});

test('«só o que falhas» põe mais nos temas fracos e menos nos dominados', () => {
  const items = [
    item({ topicId: 1, questionCount: 4, attempted: 10, correct: 9 }),
    item({ topicId: 2, questionCount: 4, attempted: 10, correct: 3 }),
    item({ topicId: 3, questionCount: 4, attempted: 0 }),
  ];
  assert.deepEqual(presetCounts(items, 'fracos'), { 1: 2, 2: 8, 3: 8 });
});

test('quem nunca tentou um tema conta como fraco, sem percentagem', () => {
  assert.deepEqual(masteryOf({ attempted: 0, correct: 0 }), { pct: null, weak: true });
  assert.deepEqual(masteryOf({ attempted: 5, correct: 3 }), { pct: 60, weak: false });
  assert.deepEqual(masteryOf({ attempted: 5, correct: 2 }), { pct: 40, weak: true });
});

test('o tempo do treino é proporcional ao da prova, com o mínimo de 5 minutos', () => {
  const plan = { durationMinutes: 60, items: [item({ topicId: 1, questionCount: 6 }), item({ topicId: 2, questionCount: 4 })] };
  assert.equal(summarize(plan, { 1: 3, 2: 2 }).minutes, 30);
  assert.equal(summarize(plan, { 1: 1, 2: 0 }).minutes, 6);
  assert.equal(summarize({ durationMinutes: 6, items: plan.items }, { 1: 1 }).minutes, 5);
  assert.equal(summarize(plan, {}).minutes, null);
  assert.equal(summarize({ durationMinutes: null, items: plan.items }, { 1: 3 }).minutes, null);
});

test('o resumo conta os temas com menos questões do que as da prova', () => {
  const plan = { durationMinutes: 60, items: [item({ topicId: 1, questionCount: 3, available: 2 }), item({ topicId: 2, questionCount: 3, available: 9 })] };
  assert.deepEqual(summarize(plan, { 1: 5, 2: 3 }), { questions: 5, minutes: 50, short: 1 });
});

test('só seguem para o servidor os temas com questões', () => {
  const plan = { items: [item({ topicId: 1 }), item({ topicId: 2 }), item({ topicId: 3, available: 0 })] };
  assert.deepEqual(picksOf(plan, { 1: 2, 2: 0, 3: 4 }), [{ topicId: 1, count: 2 }]);
});

test('de onde vêm as questões, por extenso', () => {
  const src = (year: string | number | null, count: number) => ({ statementId: count, title: 't', year, count });
  assert.equal(sourcesLabel({ available: 0, sources: [] }), 'Ainda sem questões deste tema');
  assert.equal(sourcesLabel({ available: 1, sources: [src('2024/2025', 1)] }), '1 questão de 1 prova · 2024');
  assert.equal(sourcesLabel({ available: 9, sources: [src('2023/2024', 4), src('2025/2026', 5)] }), '9 questões de 2 provas · 2023 a 2025');
  assert.equal(sourcesLabel({ available: 7, sources: [src(2023, 3), src(2025, 4)] }), '7 questões de 2 provas · 2023 a 2025');
  assert.equal(sourcesLabel({ available: 3, sources: [src(null, 3)] }), '3 questões de 1 prova');
});

test('níveis e valores como se escrevem em Angola', () => {
  assert.equal(levelLabel('APPLICATION'), 'Aplicação');
  assert.equal(levelLabel('knowledge'), 'Conhecimento');
  assert.equal(levelLabel(null), null);
  assert.equal(levelLabel('OTHER'), null);
  assert.equal(valuesLabel(4.5), '4,5 valores');
  assert.equal(valuesLabel(1), '1 valor');
  assert.equal(valuesLabel(null), null);
});

test('um treino nunca passa das 100 questões que o servidor aceita', () => {
  const items = [item({ topicId: 1, available: 80 }), item({ topicId: 2, available: 80 })];
  const picks = picksOf({ items }, { 1: 80, 2: 80 });
  assert.deepEqual(picks, [{ topicId: 1, count: 80 }, { topicId: 2, count: 20 }]);
  assert.equal(summarize({ durationMinutes: 60, items }, { 1: 80, 2: 80 }).questions, 100);
});
