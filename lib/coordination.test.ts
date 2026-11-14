// Testes das regras das salas da instituição:  node --test lib/coordination.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_ROOM_FILTER,
  filterRooms,
  gradeStatusLabel,
  gradeText,
  institutionNamesByClassCode,
  roomCounts,
  roomPhaseLabel,
  roomProgress,
  roomsByUrgency,
} from './coordination.ts';
import { PHASE_LABEL } from './exam-rooms/model.ts';
import type { CoordinationRoom } from '../types/coordination.ts';

const room = (over: Partial<CoordinationRoom>): CoordinationRoom => ({
  id: 1,
  status: 'RUNNING',
  startsAt: '2026-10-15T09:00:00',
  endsAt: '2026-10-15T12:00:00',
  className: 'A1',
  statementTitle: 'P1',
  teacherAccountId: 1,
  teacherName: 'Abner',
  participants: 16,
  finished: 4,
  pendingAnswers: 0,
  ...over,
});

const AGORA = '2026-10-15T10:00:00';
const ABRIL = '2026-04-15T10:00:00';

test('o ponto da sala diz quantos entregaram e o que falta rever', () => {
  assert.equal(roomProgress(room({ participants: 0 })), 'Sem alunos');
  assert.equal(roomProgress(room({}), AGORA), '4 de 16 entregaram');
  assert.equal(roomProgress(room({ pendingAnswers: 1 }), AGORA), '4 de 16 entregaram; 1 resposta por rever');
  assert.equal(roomProgress(room({ pendingAnswers: 5 }), AGORA), '4 de 16 entregaram; 5 respostas por rever');
  assert.equal(roomProgress(room({ status: 'CLOSED', finished: 16 }), AGORA), '16 de 16 entregaram; tudo corrigido');
  assert.equal(roomProgress(room({ endsAt: '2026-10-15T09:30:00', finished: 16 }), AGORA), '16 de 16 entregaram; tudo corrigido');
});

test('a fase da sala: agendada antes de começar, a decorrer na janela, terminada depois', () => {
  const base = { status: 'DRAFT' as const, startsAt: '2026-10-15T11:00:00', endsAt: '2026-10-15T13:00:00' };
  assert.equal(roomPhaseLabel(room({ ...base, status: 'OPEN' as const }), AGORA), 'Agendada');
  assert.equal(roomPhaseLabel(room({ ...base, status: 'OPEN' as const }), ABRIL), 'Agendada');
  assert.equal(roomPhaseLabel(room({}), AGORA), 'A decorrer');
  assert.equal(roomPhaseLabel(room({ endsAt: '2026-10-15T09:30:00', status: 'OPEN' as const }), AGORA), 'Terminada');
  assert.equal(roomPhaseLabel(room({ status: 'CLOSED' as const }), AGORA), 'Terminada');
  // A fase vinda do backend vence o cálculo local.
  assert.equal(roomPhaseLabel(room({ phase: 'SCHEDULED' as const, startsAt: '2026-10-15T09:00:00', endsAt: '2026-10-15T10:30:00', status: 'RUNNING' as const }), AGORA), 'Agendada');
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

test('as salas que precisam do professor vêm primeiro, depois as a decorrer, depois as agendadas e as terminadas', () => {
  const list = [
    room({ id: 1, status: 'CLOSED' }),
    room({ id: 2, status: 'RUNNING' }),
    room({ id: 3, status: 'CLOSED', pendingAnswers: 3 }),
    room({ id: 4, status: 'DRAFT', startsAt: '2026-10-15T11:00:00', endsAt: '2026-10-15T13:00:00' }),
  ];
  assert.deepEqual(roomsByUrgency(list, AGORA).map((r) => r.id), [3, 2, 4, 1]);
});

test('os rótulos das salas da coordenação vêm da fase única das salas de prova', () => {
  assert.equal(roomPhaseLabel(room({ status: 'CLOSED' }), AGORA), PHASE_LABEL.ENDED);
});

test('os filtros da coordenação repartem as salas e contam-nas', () => {
  const list = [
    room({ id: 1, status: 'DRAFT', pendingAnswers: 0 }),
    room({ id: 2, status: 'OPEN', pendingAnswers: 0 }),
    room({ id: 3, status: 'RUNNING', pendingAnswers: 2 }),
    room({ id: 4, status: 'CLOSED', pendingAnswers: 0 }),
  ];
  assert.deepEqual(filterRooms(list, DEFAULT_ROOM_FILTER).map((r) => r.id), [1, 2, 3, 4]);
  assert.deepEqual(filterRooms(list, 'por-rever').map((r) => r.id), [3]);
  assert.deepEqual(filterRooms(list, 'em-curso').map((r) => r.id), [2, 3]);
  assert.deepEqual(filterRooms(list, 'rascunhos').map((r) => r.id), [1]);
  assert.deepEqual(filterRooms(list, 'fechadas').map((r) => r.id), [4]);
  assert.deepEqual(roomCounts(list), { todas: 4, 'por-rever': 1, 'em-curso': 2, rascunhos: 1, fechadas: 1 });
});

test('a escola da sala sai do código da turma sem inventar quando o código é ambíguo', () => {
  const institutions = [
    { id: 1, name: 'ITEL' },
    { id: 2, name: 'IMIL' },
  ];
  const byCode = institutionNamesByClassCode(
    [
      { code: '12A', institutionId: 1 },
      { code: '10A', institutionId: 2 },
      { code: '12A', institutionId: 2 },
      { code: '11B', institutionId: null },
    ],
    institutions,
  );
  assert.equal(byCode.get('10A'), 'IMIL');
  assert.equal(byCode.get('12A'), undefined);
  assert.equal(byCode.get('11B'), undefined);
});
