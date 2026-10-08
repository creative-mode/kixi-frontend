// Testes do ano letivo corrente:  node --test student/lib/school-year.test.ts
//
// O bug que estes testes apanham: um ano letivo é dois inteiros, 2025/2026, e em Março de
// 2026 tanto o 2025/2026 como o 2026/2027 "contêm" 2026. Escolher o de startYear mais alto
// ofereceria um ano que ainda não começou.
import test from 'node:test';
import assert from 'node:assert/strict';
import { currentSchoolYear, schoolYearLabel, ACADEMIC_YEAR_START_MONTH } from './school-year.ts';
import type { SchoolYear } from './types.ts';

const years: SchoolYear[] = [
  { id: 1, startYear: 2025, endYear: 2026 },
  { id: 2, startYear: 2026, endYear: 2027 },
  { id: 3, startYear: 2024, endYear: 2025 },
];

const at = (iso: string) => new Date(iso);

test('o ano que contém hoje e já começou, no fim do ano', () => {
  assert.equal(currentSchoolYear(years, at('2026-06-01'))?.id, 1);
});

test('no intervalo, escolhe o ano que começou, não o que ainda vai começar', () => {
  // Março de 2026 está dentro de 2025/2026 e de 2026/2027. O certo é o 2025/2026.
  assert.equal(currentSchoolYear(years, at('2026-03-15'))?.id, 1);
});

test('no mês de corte, o ano novo já vale', () => {
  const september = at('2026-09-01');
  assert.equal(currentSchoolYear(years, september)?.id, 2);
  // O mês de corte é uma convenção: com outro mês, a resposta muda, e é isso que se quer ver.
  assert.equal(currentSchoolYear(years, september, 9)?.id, 1);
});

test('no dia antes do mês de corte, o ano novo ainda não vale', () => {
  const august = at('2026-08-31');
  assert.equal(currentSchoolYear(years, august)?.id, 1);
  // Um corte mais tarde (Outubro) também deixa Agosto no ano anterior.
  assert.equal(currentSchoolYear(years, august, 9)?.id, 1);
});

test('o mês de corte decide mesmo, dentro do mesmo dia', () => {
  // Junho de 2026 está dentro de 2025/2026 e de 2026/2027. Com corte em Maio já é o
  // ano novo; com corte em Setembro (o omisso) ainda é o anterior.
  const june = at('2026-06-15');
  assert.equal(currentSchoolYear(years, june, 4)?.id, 2);
  assert.equal(currentSchoolYear(years, june)?.id, 1);
});

test('em Janeiro, antes de Setembro, ainda é o ano que começou no ano anterior', () => {
  assert.equal(currentSchoolYear(years, at('2027-01-10'))?.id, 2);
});

test('depois do fim do ano, sem nenhum ano que o contenha, o mais recente que já começou', () => {
  assert.equal(currentSchoolYear(years, at('2030-05-05'))?.id, 2);
});

test('quando nenhum ano começou, o mais antigo', () => {
  const future: SchoolYear[] = [
    { id: 9, startYear: 2031, endYear: 2032 },
    { id: 10, startYear: 2033, endYear: 2034 },
  ];
  assert.equal(currentSchoolYear(future, at('2030-01-01'))?.id, 9);
});

test('sem anos não escolhe nada', () => {
  assert.equal(currentSchoolYear([], at('2026-03-15')), undefined);
});

test('o mês de corte por omissão é Setembro', () => {
  assert.equal(ACADEMIC_YEAR_START_MONTH, 8);
});

test('não altera o array recebido', () => {
  const original = [...years];
  currentSchoolYear(years, at('2030-05-05'));
  assert.deepEqual(years, original);
});

test('o rótulo é o intervalo', () => {
  assert.equal(schoolYearLabel(years[0]), '2025/2026');
});