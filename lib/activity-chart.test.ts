// Texto do gráfico de atividade (#534): node --test lib/activity-chart.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { activitySummary, describePoint } from './activity-chart.ts';

const points = (...finished: number[]) => finished.map((n) => ({ finished: n }));

test('o resumo diz «dias» na vista diária', () => {
  assert.equal(activitySummary(points(2, 3, 0), 'dia'), '5 simulações concluídas em 3 dias');
});

test('o resumo diz «semanas» na vista semanal, e não «8 dias»', () => {
  assert.equal(activitySummary(points(1, 0, 0, 0, 0, 0, 0, 2), 'semana'), '3 simulações concluídas em 8 semanas');
});

test('o resumo respeita o singular', () => {
  assert.equal(activitySummary(points(1), 'dia'), '1 simulação concluída em 1 dia');
  assert.equal(activitySummary(points(1), 'semana'), '1 simulação concluída em 1 semana');
});

test('sem simulações o resumo diz zero, não desaparece', () => {
  assert.equal(activitySummary([], 'dia'), '0 simulações concluídas em 0 dias');
});

test('o ponto anunciado leva período, concluídas e nota', () => {
  assert.equal(describePoint('03 nov', 4, '62,5%'), '03 nov: 4 simulações concluídas, nota média 62,5%');
});

test('um período sem nota diz que não há nota, em vez de 0%', () => {
  assert.equal(describePoint('10 nov', 0, null), '10 nov: 0 simulações concluídas, sem nota média');
  assert.equal(describePoint('10 nov', 1, null), '10 nov: 1 simulação concluída, sem nota média');
});
