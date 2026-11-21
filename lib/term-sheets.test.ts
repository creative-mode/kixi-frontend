// Regras de apresentação das pautas:  node --test lib/term-sheets.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { applyFilters, classLabel, filterOptions, formatGrade, isFinal, isNegative, isUnavailableStatus, NO_FILTERS, normalizeRow, normalizeSummary, parseDetail, parseList, schoolYearLabel, sheetTitle, SEM_NOTA, subjectLabel, termLabel, wasAbsent } from './term-sheets.ts';

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

test('o detalhe do backend vem aninhado ({ sheet, rows }) e junta-se numa só pauta', () => {
  const rows = [{ accountId: 1, number: 1, name: 'Ana', mac: 15, p1: 20, p2: 20, mt: 18, status: 'POSITIVA', adjusted: false }];
  const d = parseDetail({ sheet: sheet({ sheetId: 'PT-9' }), rows });
  assert.equal(d.sheetId, 'PT-9');
  assert.equal(d.statistics.media, 13);
  assert.deepEqual(d.rows, rows);
});

test('um detalhe sem a forma {sheet, rows} é recusado', () => {
  for (const body of [null, {}, { sheet: sheet({}) }, { rows: [] }, { ...(sheet({}) as object), rows: [] }, 'x']) assert.throws(() => parseDetail(body), /inválida/);
});

test('403 e 404 da pauta são o mesmo caso para o ecrã; o resto não', () => {
  assert.equal(isUnavailableStatus(403), true);
  assert.equal(isUnavailableStatus(404), true);
  for (const s of [200, 401, 500]) assert.equal(isUnavailableStatus(s), false);
});

// O payload real da vaga 1C: o motor aceita (200) uma pauta registada só com o `classId`, e o ADMIN vê-a na lista.
const SO_CLASS_ID = { sheetId: 'E2E-1A-FUZZ', classId: 1, status: null, termNumber: null, schoolYear: null, className: null, grade: null, course: null, subjectId: null, subjectName: null, subjectCode: null, statistics: null, updatedAt: null, institutionId: null } as never;

test('uma pauta só com classId não rebenta a ordenação nem as opções, e fica no fim da lista', () => {
  const lista = [SO_CLASS_ID, sheet({ sheetId: 'B', termNumber: 2 }), sheet({ sheetId: 'A', termNumber: 1 })];
  assert.deepEqual(applyFilters(lista, NO_FILTERS).map((s) => s.sheetId), ['A', 'B', 'E2E-1A-FUZZ']);
  const o = filterOptions(lista);
  assert.deepEqual(o.schoolYears, ['2025/2026']);
  assert.deepEqual(o.terms, [1, 2]);
  assert.ok(o.subjects.every((s) => s.label.length > 0));
  assert.ok(o.classes.every((c) => !/null|undefined|NaN/.test(c.label)));
});

test('a ordenação é determinística: com todos os campos nulos desempata pelo id, seja qual for a ordem de entrada', () => {
  const nulas = ['Z', 'M', 'A'].map((id) => ({ sheetId: id, classId: 1 }) as never);
  assert.deepEqual(applyFilters(nulas, NO_FILTERS).map((s) => s.sheetId), ['A', 'M', 'Z']);
  assert.deepEqual(applyFilters([...nulas].reverse(), NO_FILTERS).map((s) => s.sheetId), ['A', 'M', 'Z']);
});

test('a normalização dá texto legível a cada campo em falta, sem null, undefined nem NaN', () => {
  const s = normalizeSummary(SO_CLASS_ID)!;
  assert.equal(s.sheetId, 'E2E-1A-FUZZ');
  assert.equal(subjectLabel(s), 'Sem disciplina');
  assert.equal(termLabel(s.termNumber), 'Sem trimestre');
  assert.equal(schoolYearLabel(s.schoolYear), 'Sem ano letivo');
  assert.equal(classLabel(s), 'Sem turma');
  assert.equal(sheetTitle(s), 'Sem disciplina · Sem turma · Sem trimestre');
  assert.equal(formatGrade(s.statistics.media), SEM_NOTA);
  assert.equal(s.statistics.avaliados, 0);
  assert.equal(isFinal(s), false);
  assert.doesNotMatch(sheetTitle(SO_CLASS_ID), /null|undefined|NaN/);
});

test('a normalização é idempotente e não mexe numa pauta completa', () => {
  const completa = sheet({});
  assert.deepEqual(normalizeSummary(completa), completa);
  assert.deepEqual(normalizeSummary(normalizeSummary(SO_CLASS_ID)), normalizeSummary(SO_CLASS_ID));
});

test('a lista descarta o que não é uma pauta (sem id) e normaliza o resto', () => {
  const l = parseList([null, 3, {}, { sheetId: '' }, { sheetId: 'X', classId: 4 }, sheet({ sheetId: 'OK' })]);
  assert.deepEqual(l.map((s) => s.sheetId), ['X', 'OK']);
  assert.throws(() => parseList({ not: 'a list' }), /inválida/);
});

test('o detalhe também tolera um resumo incompleto', () => {
  const d = parseDetail({ sheet: { sheetId: 'E2E-1A-FUZZ', classId: 1, statistics: null }, rows: [] });
  assert.equal(subjectLabel(d), 'Sem disciplina');
  assert.equal(d.statistics.positivas, 0);
});

test('o rótulo de um trimestre válido mantém-se', () => {
  assert.equal(termLabel(2), '2.º trimestre');
  assert.equal(schoolYearLabel('2025/2026'), '2025/2026');
  assert.equal(classLabel(sheet({})), '12.ª M · SI');
});

test('as linhas incompletas ficam sem nota (nunca zero) e as que não são objectos caem', () => {
  const d = parseDetail({ sheet: sheet({}), rows: [null, 'x', { accountId: 7 }, { accountId: 8, number: 2, name: 'Rui', mt: 12, status: 'POSITIVA', adjusted: true }] });
  assert.equal(d.rows.length, 2);
  assert.deepEqual([d.rows[0].mac, d.rows[0].p1, d.rows[0].p2, d.rows[0].mt], [null, null, null, null]);
  assert.equal(d.rows[0].status, 'INCOMPLETA');
  assert.equal(d.rows[0].name, 'Aluno sem nome');
  assert.equal(d.rows[1].adjusted, true);
  assert.equal(normalizeRow(null), null);
});
