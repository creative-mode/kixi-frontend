// O que falta para guardar e publicar a prova (#537): node --test lib/exam/readiness.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { missingToSave, readinessSummary } from './readiness.ts';

const ready = { hasSchool: true, hasSubject: true, hasClass: true, hasQuestion: true };

test('uma prova pronta não falta nada', () => {
  assert.deepEqual(missingToSave(ready), []);
  assert.deepEqual(readinessSummary([], 0), []);
});

test('lista o que falta pela ordem do formulário', () => {
  assert.deepEqual(missingToSave({ hasSchool: true, hasSubject: false, hasClass: false, hasQuestion: false }), ['disciplina', 'turma', 'pelo menos uma questão']);
  assert.deepEqual(missingToSave({ ...ready, hasSchool: false }), ['escola']);
});

test('o resumo diz o que falta para guardar', () => {
  assert.deepEqual(readinessSummary(['disciplina', 'turma'], 0), ['Para guardar faltam: disciplina, turma.']);
});

test('os problemas das questões só travam a publicação e dizem quantos são', () => {
  assert.deepEqual(readinessSummary([], 1), ['Para publicar, corrija 1 ponto nas questões.']);
  assert.deepEqual(readinessSummary([], 3), ['Para publicar, corrija 3 pontos nas questões.']);
});

test('as duas frases aparecem juntas quando as duas coisas faltam', () => {
  assert.deepEqual(readinessSummary(['turma'], 2), ['Para guardar faltam: turma.', 'Para publicar, corrija 2 pontos nas questões.']);
});
