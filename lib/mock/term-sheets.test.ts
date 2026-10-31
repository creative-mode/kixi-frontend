// O mock das pautas segue o contrato de kixi#506:  node --test lib/mock/term-sheets.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTermSheets, canReadSheet, lookupSheet, ownSheets, statisticsOf, summaryOf, visibleSheets, type MockWorld, type Viewer } from './term-sheets.ts';

const year = { startYear: 2025, endYear: 2026 };
const world: MockWorld = {
  classes: [
    { id: 1, code: '12B', grade: 12, course: { code: 'TISM', name: 'Técnico de Informática e Sistemas Multimédia' }, schoolYear: year },
    { id: 2, code: '11A', grade: 11, course: { code: 'TISM', name: 'Técnico de Informática e Sistemas Multimédia' }, schoolYear: year },
    { id: 3, code: '10A', grade: 10, course: { code: 'TISM', name: 'Técnico de Informática e Sistemas Multimédia' }, schoolYear: year },
  ],
  subjects: [{ id: 1, code: 'RED', name: 'Redes' }, { id: 2, code: 'SO', name: 'Sistemas Operativos' }, { id: 4, code: 'OGI', name: 'Organização' }],
  studentAccountId: 3, studentName: 'Abner Ede',
};
const sheets = buildTermSheets(world);
const assignments = [{ teacherId: 1, classId: 1, subjectId: 1 }, { teacherId: 1, classId: 1, subjectId: 4 }, { teacherId: 2, classId: 2, subjectId: 2 }];
const admin: Viewer = { accountId: 1, roles: ['ADMIN'], assignments };
const helena: Viewer = { accountId: 2, roles: ['TEACHER'], teacherId: 1, assignments };
const carlos: Viewer = { accountId: 5, roles: ['TEACHER'], teacherId: 2, assignments };
const aluno: Viewer = { accountId: 3, roles: ['STUDENT'], assignments, enrolledClassId: 1 };

test('há três trimestres, pautas fechadas e uma só registada', () => {
  const redes = sheets.filter((s) => s.subjectCode === 'RED' && s.classId === 1);
  assert.deepEqual(redes.map((s) => s.termNumber), [1, 2, 3]);
  assert.deepEqual(redes.map((s) => s.status), ['FECHADA', 'FECHADA', 'REGISTADA']);
});

test('quem faltou fica incompleto e sem nenhuma nota: nunca zero', () => {
  for (const s of sheets) {
    const diana = s.rows.find((r) => r.name === 'Diana Lopes');
    assert.ok(diana, s.sheetId);
    assert.equal(diana.status, 'INCOMPLETA');
    assert.deepEqual([diana.mac, diana.p1, diana.p2, diana.mt], [null, null, null, null]);
  }
});

test('as estatísticas saem das linhas e batem certo', () => {
  for (const s of sheets) {
    const st = statisticsOf(s.rows);
    assert.equal(st.inscritos, s.rows.length);
    assert.equal(st.avaliados + st.ausentes, st.inscritos);
    assert.equal(st.positivas + st.negativas, st.avaliados);
    assert.deepEqual(summaryOf(s).statistics, st);
    assert.equal('rows' in summaryOf(s), false);
  }
});

test('a MT é a média das três componentes e o estado vem dela', () => {
  for (const s of sheets) for (const r of s.rows) {
    if (r.mt === null) continue;
    assert.equal(r.mt, Math.floor((r.mac! + r.p1! + r.p2!) / 3 + 0.5));
    assert.equal(r.status, r.mt >= 10 ? 'POSITIVA' : 'NEGATIVA');
  }
  assert.ok(sheets.some((s) => s.rows.some((r) => r.status === 'NEGATIVA')), 'o mock tem de mostrar uma negativa');
});

test('o ADMIN vê todas as pautas, menos as anuladas', () => assert.equal(visibleSheets(admin, sheets).length, sheets.filter((s) => s.status !== 'ANULADA').length));

test('o professor só vê a turma e a disciplina que lecciona', () => {
  const dela = visibleSheets(helena, sheets);
  assert.ok(dela.length > 0);
  assert.ok(dela.every((s) => s.classId === 1 && [1, 4].includes(s.subjectId)));
  assert.deepEqual(visibleSheets(carlos, sheets).map((s) => [s.classId, s.subjectId]), [[2, 2]]);
  assert.equal(canReadSheet(carlos, sheets.find((s) => s.classId === 1)!), false);
});

test('o aluno não lê pautas por /term-sheets', () => assert.equal(visibleSheets(aluno, sheets).length, 0));

test('o aluno vê só a sua linha, só de pautas fechadas e só da sua turma', () => {
  const minhas = ownSheets(aluno, sheets);
  assert.ok(minhas.length >= 3);
  assert.ok(minhas.every((m) => sheets.find((s) => s.sheetId === m.sheetId)!.status === 'FECHADA'));
  assert.ok(minhas.every((m) => m.className === '12B'));
  assert.ok(!minhas.some((m) => m.termNumber === 3 && m.subjectCode === 'RED'), 'a registada não aparece');
  for (const m of minhas) assert.deepEqual(Object.keys(m.row).sort(), ['mac', 'mt', 'p1', 'p2', 'status']);
  assert.deepEqual(ownSheets(helena, sheets), []);
});

test('o curso é o nome do curso e a classe é o número (12)', () => {
  for (const s of sheets) {
    assert.equal(s.course, 'Técnico de Informática e Sistemas Multimédia');
    assert.ok(Number.isInteger(s.grade) && s.grade >= 10 && s.grade <= 12);
  }
});

test('uma pauta anulada existe no mock mas nunca aparece a ninguém', () => {
  const anulada = sheets.find((s) => s.status === 'ANULADA');
  assert.ok(anulada, 'o mock tem de ter uma anulada para o provar');
  for (const v of [admin, helena]) assert.ok(!visibleSheets(v, sheets).some((s) => s.status === 'ANULADA'));
  assert.ok(!ownSheets(aluno, sheets).some((m) => m.sheetId === anulada.sheetId));
  assert.deepEqual(lookupSheet(admin, sheets, anulada.sheetId), { status: 404 });
});

test('o detalhe: o professor recebe 403 numa pauta alheia e numa que não existe; o administrador 404 numa que não existe', () => {
  const alheia = sheets.find((s) => s.classId === 2)!.sheetId;
  const propria = sheets.find((s) => s.classId === 1 && s.subjectId === 1 && s.status === 'FECHADA')!;
  assert.deepEqual(lookupSheet(helena, sheets, alheia), { status: 403 });
  assert.deepEqual(lookupSheet(helena, sheets, 'PT-NAO-EXISTE'), { status: 403 });
  assert.deepEqual(lookupSheet(admin, sheets, 'PT-NAO-EXISTE'), { status: 404 });
  assert.deepEqual(lookupSheet(admin, sheets, alheia), { sheet: sheets.find((s) => s.sheetId === alheia) });
  assert.deepEqual(lookupSheet(helena, sheets, propria.sheetId), { sheet: propria });
  assert.deepEqual(lookupSheet(aluno, sheets, propria.sheetId), { status: 403 });
});
