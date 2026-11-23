import assert from 'node:assert/strict';
import { test } from 'node:test';
import { averageOf, formatGrade, groupByTerm, isDispensed, isNegative, mtRuleNote, normalizeMySheet, notasRegionLabel, parseMyTermSheets, provaText, processNumberOf, SEM_NOTA, subjectLabel, termLabel, type MyTermSheet } from './pautas-rules.ts';

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

test('o número de processo mostra-se uma vez: o primeiro que existir, aparado, ou nenhum (kixi#512)', () => {
  assert.equal(processNumberOf([{ processNumber: null }, { processNumber: ' P-2026/0042 ' }, { processNumber: 'outro' }]), 'P-2026/0042');
  assert.equal(processNumberOf([{ processNumber: null }, {}, { processNumber: '  ' }]), null);
  assert.equal(processNumberOf([]), null);
});

test('prova dispensada mostra «Dispensada», não travessão nem zero; sem o campo nada é dispensado', () => {
  const row = { mac: 14, p1: 13, p2: null, mt: 14, status: 'POSITIVA' as const, dispensed: ['P2' as const] };
  assert.equal(isDispensed(row, 'P2'), true);
  assert.equal(provaText(row, 'P2'), 'Dispensada');
  assert.equal(provaText(row, 'P1'), '13');
  assert.equal(provaText({ ...row, dispensed: undefined }, 'P2'), SEM_NOTA);
  assert.equal(provaText({ ...row, dispensed: [] }, 'P2'), SEM_NOTA);
});

test('a nota da MT diz que foi calculada sem a prova dispensada', () => {
  assert.equal(mtRuleNote({ dispensed: ['P1'] }), 'MT calculada sem a P1 (dispensada).');
  assert.equal(mtRuleNote({ dispensed: ['P1', 'P2'] }), 'MT calculada sem a P1 e a P2 (dispensadas).');
  assert.equal(mtRuleNote({ dispensed: [] }), null);
  assert.equal(mtRuleNote({}), null);
});

// Uma pauta incompleta (só o id) também pode chegar ao aluno: a página nunca pode cair por causa dela.
const INCOMPLETA = { sheetId: 'PT-X', termNumber: null, schoolYear: null, subjectName: null, subjectCode: null, className: null, row: null } as never;

test('uma pauta com campos nulos agrupa e ordena sem rebentar, e fica no fim', () => {
  const grupos = groupByTerm([INCOMPLETA, sheet({ sheetId: 'A', termNumber: 2 }), sheet({ sheetId: 'B', termNumber: 1 })]);
  assert.deepEqual(grupos.map((g) => g.termNumber), [1, 2, 0]);
  assert.equal(grupos[2].average, null);
  assert.equal(termLabel(0), 'Sem trimestre');
  assert.equal(termLabel(2), '2.º trimestre');
});

test('as disciplinas do mesmo trimestre ordenam-se por nome, com desempate estável pelo id e «Sem disciplina» para o nulo', () => {
  const g = groupByTerm([sheet({ sheetId: 'Z', subjectName: 'Redes' }), { sheetId: 'PT-X', termNumber: 1, schoolYear: '2025/2026', subjectName: null, row: null } as never, sheet({ sheetId: 'A', subjectName: 'Redes' })])[0];
  assert.deepEqual(g.sheets.map((x) => x.sheetId).slice(0, 2), ['A', 'Z']);
  assert.equal(subjectLabel(g.sheets[2]), 'Sem disciplina');
});

test('a normalização dá à linha em falta «sem nota» e «Incompleta», nunca zero', () => {
  const n = normalizeMySheet(INCOMPLETA)!;
  assert.deepEqual([n.row.mac, n.row.p1, n.row.p2, n.row.mt], [null, null, null, null]);
  assert.equal(n.row.status, 'INCOMPLETA');
  assert.equal(n.schoolYear, '');
  assert.equal(averageOf([n]), null);
});

test('a lista do aluno descarta o que não é pauta e mantém as completas intactas', () => {
  const completa = sheet({ row: { mac: 14, p1: 13, p2: null, mt: 14, status: 'POSITIVA', dispensed: ['P2'] } });
  const l = parseMyTermSheets([null, {}, completa, INCOMPLETA]);
  assert.equal(l.length, 2);
  assert.deepEqual(l[0], completa);
  assert.throws(() => parseMyTermSheets({ x: 1 }), /inválida/);
});

test('a MAC dispensada mostra «Dispensada» (e não travessão) e a MT diz que foi calculada sem ela', () => {
  const row = { mac: null, p1: 13, p2: 15, mt: 14, status: 'POSITIVA' as const, dispensed: ['MAC' as const] };
  assert.equal(isDispensed(row, 'MAC'), true);
  assert.equal(provaText(row, 'MAC'), 'Dispensada');
  assert.equal(provaText({ ...row, dispensed: [] }, 'MAC'), SEM_NOTA);
  assert.equal(provaText({ ...row, dispensed: undefined }, 'MAC'), SEM_NOTA);
  assert.equal(provaText(row, 'P1'), '13');
  assert.equal(mtRuleNote(row), 'MT calculada sem a MAC (dispensada).');
});

test('a nota da MT concorda no plural e combina P1, P2 e MAC por ordem', () => {
  assert.equal(mtRuleNote({ dispensed: ['MAC', 'P1'] }), 'MT calculada sem a P1 e a MAC (dispensadas).');
  assert.equal(mtRuleNote({ dispensed: ['P2', 'MAC'] }), 'MT calculada sem a P2 e a MAC (dispensadas).');
  assert.equal(mtRuleNote({ dispensed: ['MAC', 'P2', 'P1'] }), 'MT calculada sem a P1, a P2 e a MAC (dispensadas).');
  assert.equal(mtRuleNote({ dispensed: ['P1', 'P1'] }), 'MT calculada sem a P1 (dispensada).');
});

test('a normalização mantém a MAC dispensada e descarta valores desconhecidos', () => {
  const n = normalizeMySheet({ sheetId: 'PT-1', row: { mt: 12, status: 'POSITIVA', dispensed: ['MAC', 'XX', 'P2', 3] } })!;
  assert.deepEqual(n.row.dispensed, ['MAC', 'P2']);
});

test('a região da tabela de notas tem nome (acesso por teclado), com trimestre e ano; sem eles não inventa', () => {
  assert.equal(notasRegionLabel({ termNumber: 1, schoolYear: '2026/2027' }), 'Notas do 1.º trimestre, 2026/2027');
  assert.equal(notasRegionLabel({ termNumber: 2, schoolYear: '' }), 'Notas do 2.º trimestre');
  assert.equal(notasRegionLabel({ termNumber: 0, schoolYear: '2026/2027' }), 'Notas sem trimestre, 2026/2027');
  assert.equal(notasRegionLabel({ termNumber: 0, schoolYear: '' }), 'Notas sem trimestre');
});
