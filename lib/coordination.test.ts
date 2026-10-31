// Testes das regras das salas da instituição:  node --test lib/coordination.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { gradeStatusLabel, gradeText, roomProgress, roomsByUrgency } from './coordination.ts';
import type { CoordinationRoom } from '../types/coordination.ts';

const room = (over: Partial<CoordinationRoom>): CoordinationRoom => ({
  id: 1, status: 'RUNNING', startsAt: '', endsAt: '', className: 'A1', statementTitle: 'P1', teacherAccountId: 1, teacherName: 'Abner',
  participants: 16, finished: 4, pendingAnswers: 0, ...over,
});

test('o ponto da sala diz quantos entregaram e o que falta rever', () => {
  assert.equal(roomProgress(room({ participants: 0 })), 'Sem alunos');
  assert.equal(roomProgress(room({})), '4 de 16 entregaram');
  assert.equal(roomProgress(room({ pendingAnswers: 1 })), '4 de 16 entregaram; 1 resposta por rever');
  assert.equal(roomProgress(room({ pendingAnswers: 5 })), '4 de 16 entregaram; 5 respostas por rever');
  assert.equal(roomProgress(room({ status: 'CLOSED', finished: 16 })), '16 de 16 entregaram; tudo corrigido');
});

test('quem não entregou fica com travessão, nunca com zero', () => {
  assert.equal(gradeText({ status: null, finalScore: null }), '—');
  assert.equal(gradeText({ status: 'IN_PROGRESS', finalScore: 0 }), '—');
  assert.equal(gradeText({ status: 'FINISHED', finalScore: null }), '—');
  assert.equal(gradeText({ status: 'FINISHED', finalScore: 4.5 }), '4,5');
  assert.equal(gradeText({ status: 'FINISHED', finalScore: 12 }), '12');
  assert.equal(gradeStatusLabel({ status: null, pendingAnswers: 0 }), 'Não entrou');
  assert.equal(gradeStatusLabel({ status: 'FINISHED', pendingAnswers: 2 }), 'Por corrigir');
  assert.equal(gradeStatusLabel({ status: 'FINISHED', pendingAnswers: 0 }), 'Corrigida');
});

test('as salas que precisam do professor vêm primeiro', () => {
  const list = [room({ id: 1, status: 'CLOSED' }), room({ id: 2, status: 'RUNNING' }), room({ id: 3, status: 'CLOSED', pendingAnswers: 3 }), room({ id: 4, status: 'DRAFT' })];
  assert.deepEqual(roomsByUrgency(list).map((r) => r.id), [3, 2, 4, 1]);
});
