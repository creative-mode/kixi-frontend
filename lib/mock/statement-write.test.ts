// Testes de quem pode gravar um enunciado:  node --test lib/mock/statement-write.test.ts
//
// São as regras do `StatementService.update` do backend. O mock deixava qualquer um
// gravar qualquer coisa, e foi assim que o ecrã de revisão parecia funcionar para um
// professor quando o backend lhe devolveria 422 ou 403.
import test from 'node:test';
import assert from 'node:assert/strict';
import { updateProblem, type WriteWorld } from './statement-write.ts';

// Escola 1 dá as disciplinas 10 e 11; a professora (conta 7, teacher 70) é da escola
// e dá a disciplina 10 na turma 100. A conta 8 é professor sem atribuição nenhuma.
const world: WriteWorld = {
  institutions: [{ id: 1 }, { id: 2 }],
  teachers: [{ id: 70, accountId: 7 }, { id: 80, accountId: 8 }],
  institutionTeachers: [{ institutionId: 1, teacherId: 70 }, { institutionId: 1, teacherId: 80 }],
  institutionSubjects: [{ institutionId: 1, subjectId: 10 }, { institutionId: 1, subjectId: 11 }],
  assignments: [{ teacherId: 70, classId: 100, subjectId: 10 }],
};
const ocr = { institutionId: null, subjectId: null, classId: null };
const target = (institutionId: number, subjectId: number, classId: number | null) => ({ institutionId, subjectId, classId });

test('o professor grava um enunciado do OCR na turma e disciplina que dá', () => {
  assert.equal(updateProblem(world, 7, false, ocr, target(1, 10, 100)), null);
});

test('o professor tem de escolher a turma (422)', () => {
  assert.equal(updateProblem(world, 7, false, ocr, target(1, 10, null))?.status, 422);
});

test('a disciplina tem de ser da escola (422)', () => {
  const p = updateProblem(world, 7, false, ocr, target(1, 99, 100));
  assert.deepEqual(p, { status: 422, message: 'Subject is not taught by this institution' });
});

test('o professor só grava turma e disciplina que lhe estão atribuídas (403)', () => {
  assert.deepEqual(updateProblem(world, 7, false, ocr, target(1, 11, 100)), { status: 403, message: 'Teacher is not assigned to this class and subject' });
  assert.equal(updateProblem(world, 8, false, ocr, target(1, 10, 100))?.status, 403);
});

test('o professor não grava numa escola a que não pertence (403)', () => {
  assert.deepEqual(updateProblem(world, 7, false, ocr, target(2, 10, 100)), { status: 403, message: 'Teacher is not affiliated with this institution' });
});

test('um enunciado da escola sem turma só o administrador o muda', () => {
  const stored = { institutionId: 1, subjectId: 10, classId: null };
  assert.equal(updateProblem(world, 7, false, stored, target(1, 10, 100))?.status, 403);
  assert.equal(updateProblem(world, 1, true, stored, target(1, 10, null)), null);
});

test('o administrador não precisa de turma, mas a disciplina tem de ser da escola', () => {
  assert.equal(updateProblem(world, 1, true, ocr, target(1, 11, null)), null);
  assert.equal(updateProblem(world, 1, true, ocr, target(1, 99, null))?.status, 422);
  assert.equal(updateProblem(world, 1, true, ocr, target(3, 10, null))?.status, 404);
});
