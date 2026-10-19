import assert from 'node:assert/strict';
import { test } from 'node:test';
import { entrySummary, groupByYear, parseAcademicYear, parseExperience } from './experience-rules.ts';

const raw = [
  { schoolYearId: 1, schoolYear: '2025/2026', school: { id: 1, name: 'ITEL' }, course: 'Informática', class: '11B', grade: '11.ª classe' },
  { schoolYearId: 2, schoolYear: '2026/2027', school: { id: 1, name: 'ITEL' }, course: 'Informática', className: 'Turma 12B' },
  { schoolYearId: 3, schoolYear: '2024/2025', schoolName: 'Escola B' },
  { schoolYear: '2020/2021' },
  { school: 'Sem ano' },
];

test('lê a experiência, ignora linhas sem escola ou ano e aceita lista ou objecto', () => {
  assert.equal(parseExperience(raw).length, 3);
  assert.equal(parseExperience({ entries: raw }).length, 3);
  assert.deepEqual(parseExperience(null), []);
  assert.deepEqual(parseExperience({ nada: 1 }), []);
});

test('a cronologia vai do ano mais recente para o mais antigo e agrupa as escolas do ano', () => {
  const g = groupByYear([...parseExperience(raw), ...parseExperience([{ schoolYear: '2026/2027', school: 'Outra' }])]);
  assert.deepEqual(g.map((x) => x.schoolYear), ['2026/2027', '2025/2026', '2024/2025']);
  assert.equal(g[0].entries.length, 2);
});

test('a linha de resumo não repete «Turma» e mostra as disciplinas do professor', () => {
  const [a, b] = parseExperience(raw);
  assert.equal(entrySummary(a), 'Informática · Turma 11B · 11.ª classe');
  assert.equal(entrySummary(b), 'Informática · Turma 12B');
  assert.equal(entrySummary({ ...a, subjects: ['Matemática', 'Física'] }), 'Matemática, Física');
});

test('o histórico académico lê provas, calcula a média e ignora lixo', () => {
  const y = parseAcademicYear({ records: [{ id: 1, title: 'A', score: 10 }, { id: 2, title: 'B', score: 15 }, { title: 'sem id' }] }, 7);
  assert.equal(y.schoolYearId, 7);
  assert.equal(y.records.length, 2);
  assert.equal(y.average, 12.5);
  assert.equal(parseAcademicYear(null, 1).records.length, 0);
});
