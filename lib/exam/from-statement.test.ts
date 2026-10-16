import assert from 'node:assert/strict';
import test from 'node:test';

import { draftFromStatement } from './from-statement.ts';
import { kindOf, totalScore } from './draft.ts';

const opt = (id: number, label: string, text: string, isCorrect = false) => ({ id, optionLabel: label, optionText: text, isCorrect });

const STATEMENT = {
  title: 'Exame de SEAC', examType: 'Exame', durationMinutes: 90, variant: 'A', instructions: 'Leia com atenção.\n\nResponda de forma clara.',
  questions: [
    { id: 1, number: 1, questionType: 'multiple_choice', text: 'Qual é o ID?', maxScore: 5, options: [opt(11, 'A', '10.1.0.1'), opt(12, 'B', '192.168.1.100', true)] },
    { id: 2, number: 2, questionType: 'group', text: 'Resolva:', options: [] },
    { id: 21, number: 201, parentId: 2, label: 'a', questionType: 'open', text: 'Calcule x.', maxScore: 2, options: [] },
    { id: 22, number: 202, parentId: 2, label: 'b', questionType: 'multiple_choice', text: 'Qual a máscara?', maxScore: 3, options: [opt(31, 'A', '0.0.3.255', true), opt(32, 'B', '0.0.0.7')] },
    { id: 3, number: 3, questionType: 'open', text: 'Explique.', maxScore: 4, options: [] },
  ],
};

test('o enunciado guardado vira o rascunho: questões, grupo com alíneas e resposta correcta marcada', () => {
  const { draft } = draftFromStatement(STATEMENT, { subject: 'SEAC', grade: 12, schoolYear: '2025/2026' });
  assert.deepEqual(draft.items.map((q) => kindOf(q)), ['multiple_choice', 'group', 'open']);
  assert.deepEqual(draft.items[1].items?.map((i) => [i.kind, i.points]), [['open', 2], ['multiple_choice', 3]]);
  assert.equal(draft.items[0].options[1].correct, true);
  assert.equal(totalScore(draft.items), 14);
});

test('o cabeçalho leva a disciplina, a classe, o ano, a série e as regras sem linhas vazias', () => {
  const { draft, school } = draftFromStatement(STATEMENT, { subject: 'SEAC', grade: 12, schoolYear: '2025/2026', institution: 'ITEL' });
  assert.deepEqual([draft.subject, draft.grade, draft.schoolYear, draft.variant, draft.duration, draft.kind], ['SEAC', '12ª Classe', '2025/2026', 'A', 90, 'Exame']);
  assert.deepEqual(draft.rules, ['Leia com atenção.', 'Responda de forma clara.']);
  assert.equal(school.name, 'ITEL');
});

test('as figuras de cada questão seguem para a folha', () => {
  const { draft } = draftFromStatement(STATEMENT, { images: { 1: [{ imageUrl: '/uploads/q1.png', caption: 'Figura 1' }] } });
  assert.deepEqual(draft.items[0].images, [{ dataUrl: '/uploads/q1.png', caption: 'Figura 1' }]);
  assert.equal(draft.items[2].images, undefined);
});

test('sem contexto o molde fica em branco em vez de inventar', () => {
  const { draft, school } = draftFromStatement({ questions: [] });
  assert.deepEqual([draft.subject, draft.grade, draft.schoolYear, school.name], ['', '', '', '']);
});
