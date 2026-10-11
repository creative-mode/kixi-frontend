// node --test lib/crud/teacher-scope.test.ts
//
// Os casos da revisão do #114: a Helena (12B · Redes) e o Carlos (11A · SO).
// Com o filtro antigo (turma OU disciplina) a Helena via provas de outras
// disciplinas da 12B e o Carlos via provas de SO da 12B.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  answerInScope,
  buildScope,
  classInScope,
  closedScope,
  openScope,
  simulationInScope,
  statementInScope,
  teacherCanWrite,
} from './teacher-scope.ts';

const C12B = 1;
const C11A = 2;
const REDES = 10;
const SO = 11;
const MAT = 12;
const ESCOLA = 100;

const helena = [{ classId: C12B, subjectId: REDES, deletedAt: null }];
const carlos = [{ classId: C11A, subjectId: SO, deletedAt: null }];

const statements = [
  { id: 1, title: 'P1 · Redes 12B', classId: C12B, subjectId: REDES, institutionId: ESCOLA },
  { id: 2, title: 'P2 · SO 12B', classId: C12B, subjectId: SO, institutionId: ESCOLA },
  { id: 3, title: 'Exame · Matemática 12B', classId: C12B, subjectId: MAT, institutionId: ESCOLA },
  { id: 4, title: 'P1 · SO 11A', classId: C11A, subjectId: SO, institutionId: ESCOLA },
  { id: 5, title: 'OCR antigo', classId: null, subjectId: null, institutionId: null },
  { id: 6, title: 'Da escola, sem turma', classId: null, subjectId: REDES, institutionId: ESCOLA },
];

const visible = (assignments: typeof helena) =>
  statements.filter((s) => teacherCanWrite(buildScope(assignments, [], []).assignments, s)).map((s) => s.id);

test('a Helena vê só o par 12B · Redes, mais os do OCR sem escola', () => {
  assert.deepEqual(visible(helena), [1, 5]);
});

test('o Carlos não vê SO da 12B, que é turma de outro professor', () => {
  assert.deepEqual(visible(carlos), [4, 5]);
});

test('um enunciado da escola sem turma é só do ADMIN', () => {
  assert.equal(teacherCanWrite([{ classId: C12B, subjectId: REDES }], statements[5]), false);
});

test('atribuições apagadas não contam', () => {
  assert.deepEqual(visible([{ classId: C12B, subjectId: REDES, deletedAt: '2026-10-01T00:00:00' } as never]), [5]);
});

test('as simulações seguem o enunciado, e as respostas seguem a simulação', () => {
  const sims = [
    { id: 70, statement: { id: 1 } },
    { id: 71, statement: { id: 2 } },
    { id: 72, statementId: 4 },
  ];
  const scope = buildScope(helena, statements, sims);
  assert.deepEqual(scope.simulationIds, [70]);
  assert.equal(simulationInScope(scope, sims[0]), true);
  assert.equal(simulationInScope(scope, sims[1]), false);
  assert.equal(answerInScope(scope, { id: 900, simulationId: 70 }), true);
  assert.equal(answerInScope(scope, { id: 901, simulationId: 71 }), false);
});

test('as turmas são as das atribuições', () => {
  const scope = buildScope(carlos, statements, []);
  assert.equal(classInScope(scope, { id: C11A }), true);
  assert.equal(classInScope(scope, { id: C12B }), false);
});

test('scope por resolver ou fechado esconde tudo; o do ADMIN mostra tudo', () => {
  for (const scope of [null, closedScope('403')]) {
    assert.equal(statementInScope(scope, statements[0]), false);
    assert.equal(classInScope(scope, { id: C12B }), false);
    assert.equal(answerInScope(scope, { simulationId: 70 }), false);
  }
  assert.equal(statementInScope(openScope(), statements[2]), true);
});
