import assert from 'node:assert/strict';
import { test } from 'node:test';
import { averageOf, formatGrade, groupByTerm, isNegative, SEM_NOTA, type MyTermSheet } from './pautas-rules.ts';

const sheet = (over: Partial<MyTermSheet> & { mt?: number | null }): MyTermSheet => ({
  sheetId: 'PT-1', termNumber: 1, schoolYear: '2025/2026', subjectName: 'Redes', subjectCode: 'RED', className: '12B',
  row: { mac: 14, p1: 13, p2: 15, mt: over.mt === undefined ? 14 : over.mt, status: 'POSITIVA' }, ...over,
});

test('sem nota é um travessão, nunca zero', () => {
  assert.equal(formatGrade(null), SEM_NOTA);
  assert.equal(formatGrade(0), '0');
  assert.equal(formatGrade(13.67), '13,67');
});

test('negativa é abaixo de 10; sem nota não é negativa', () => {
  assert.equal(isNegative(9), true);
  assert.equal(isNegative(10), false);
  assert.equal(isNegative(null), false);
});

test('a média do trimestre ignora as disciplinas sem nota e não inventa zeros', () => {
  assert.equal(averageOf([sheet({ mt: 14 }), sheet({ mt: 11 }), sheet({ mt: null })]), 12.5);
  assert.equal(averageOf([sheet({ mt: null })]), null);
  assert.equal(averageOf([]), null);
});

test('os trimestres agrupam-se: ano mais recente primeiro, depois a ordem do trimestre, disciplinas por nome', () => {
  const groups = groupByTerm([
    sheet({ sheetId: 'A', termNumber: 2, subjectName: 'SO' }), sheet({ sheetId: 'B', termNumber: 1, subjectName: 'Redes' }),
    sheet({ sheetId: 'C', termNumber: 1, subjectName: 'OGI' }), sheet({ sheetId: 'D', schoolYear: '2024/2025', termNumber: 3 }),
  ]);
  assert.deepEqual(groups.map((g) => g.key), ['2025/2026|1', '2025/2026|2', '2024/2025|3']);
  assert.deepEqual(groups[0].sheets.map((s) => s.sheetId), ['C', 'B']);
});
