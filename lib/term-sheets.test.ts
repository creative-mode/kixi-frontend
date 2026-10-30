// Regras de apresentação das pautas:  node --test lib/term-sheets.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { applyFilters, filterOptions, formatGrade, isNegative, NO_FILTERS, sheetTitle, SEM_NOTA, wasAbsent } from './term-sheets.ts';

const sheet = (over: Record<string, unknown>) => ({
  sheetId: 'PT-1', status: 'FECHADA', termNumber: 1, schoolYear: '2025/2026', classId: 1, className: 'M', grade: 12, course: 'SI',
  subjectId: 10, subjectName: 'Redes', subjectCode: 'RED',
  statistics: { media: 13, avaliados: 3, inscritos: 4, ausentes: 1, positivas: 3, negativas: 0, notaMaxima: 17, notaMinima: 10 }, updatedAt: '2026-10-30T10:00:00',
  ...over,
}) as never;

test('uma nota ausente é um travessão, nunca zero', () => {
  assert.equal(formatGrade(null), SEM_NOTA);
  assert.equal(formatGrade(undefined), SEM_NOTA);
  assert.notEqual(formatGrade(null), '0');
  assert.equal(formatGrade(0), '0');
});

test('notas inteiras sem casas e médias com vírgula e até duas casas', () => {
  assert.equal(formatGrade(13), '13');
  assert.equal(formatGrade(13.67), '13,67');
  assert.equal(formatGrade(12.5), '12,5');
});

test('abaixo de 10 é negativa; sem nota não é negativa', () => {
  assert.equal(isNegative(9), true);
  assert.equal(isNegative(10), false);
  assert.equal(isNegative(null), false);
});

test('quem faltou (incompleta ou sem MT) conta como ausente', () => {
  assert.equal(wasAbsent({ status: 'INCOMPLETA', mt: null }), true);
  assert.equal(wasAbsent({ status: 'POSITIVA', mt: null }), true);
  assert.equal(wasAbsent({ status: 'POSITIVA', mt: 12 }), false);
});

test('as opções dos filtros saem só das pautas visíveis, sem repetições', () => {
  const o = filterOptions([sheet({}), sheet({ sheetId: 'PT-2', termNumber: 2 }), sheet({ sheetId: 'PT-3', subjectId: 11, subjectName: 'OGI', classId: 2, className: 'N' })]);
  assert.deepEqual(o.schoolYears, ['2025/2026']);
  assert.deepEqual(o.terms, [1, 2]);
  assert.equal(o.classes.length, 2);
  assert.deepEqual(o.subjects.map((s) => s.label), ['OGI', 'Redes']);
});

test('os filtros combinam-se e a ordem é ano, trimestre, disciplina', () => {
  const list = [sheet({ sheetId: 'A', termNumber: 3 }), sheet({ sheetId: 'B', termNumber: 1, subjectId: 11, subjectName: 'OGI' }), sheet({ sheetId: 'C', termNumber: 1 })];
  assert.deepEqual(applyFilters(list, NO_FILTERS).map((s) => s.sheetId), ['B', 'C', 'A']);
  assert.deepEqual(applyFilters(list, { ...NO_FILTERS, termNumber: '1', subjectId: '10' }).map((s) => s.sheetId), ['C']);
  assert.deepEqual(applyFilters(list, { ...NO_FILTERS, schoolYear: '2024/2025' }), []);
});

test('o título da pauta diz disciplina, turma e trimestre', () => {
  assert.equal(sheetTitle(sheet({})), 'Redes · 12.ª M · 1.º trimestre');
});
