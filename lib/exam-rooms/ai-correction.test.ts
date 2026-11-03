// node --test lib/exam-rooms/ai-correction.test.ts
//
// O que o professor lê numa sala de um plano do trimestre, corrigida pela IA no fluxo (kixi#542).
import test from 'node:test';
import assert from 'node:assert/strict';
import { aiStateLabel, AI_LEVEL_LABEL, gradesToSend, type RoomReview } from './model.ts';

test('uma resposta por corrigir espera pela IA; a corrigida diz que foi a IA', () => {
  assert.equal(aiStateLabel({ status: 'PENDING_REVIEW' }), 'A aguardar correção automática');
  assert.equal(aiStateLabel({ status: 'AI_GRADED' }), 'Corrigida pela IA');
});

test('os níveis da IA têm frase em português', () => {
  for (const level of ['TOTAL', 'PARCIAL', 'MINIMA', 'NULA']) assert.ok(AI_LEVEL_LABEL[level]);
});

test('as respostas corrigidas pela IA nunca vão no lote de notas do professor', () => {
  const review: RoomReview = {
    pending: 1, graded: 0, aiGraded: 1, planLinked: true,
    questions: [{
      questionId: 1, number: 1, label: null, parentId: null, text: 'q', maxScore: 6, modelAnswer: null,
      answers: [
        { answerId: 1, accountId: 1, displayName: null, answerText: 'a', status: 'AI_GRADED', scoreObtained: 4, aiFeedback: 'x', aiLevel: 'PARCIAL' },
        { answerId: 2, accountId: 2, displayName: null, answerText: 'b', status: 'PENDING_REVIEW', scoreObtained: null },
      ],
    }],
  };
  // mesmo com notas escritas, só a PENDING_REVIEW entraria; numa sala de plano a UI nem mostra os campos
  assert.deepEqual(gradesToSend(review, { 1: '5', 2: '3' }).map((g) => g.answerId), [2]);
});
