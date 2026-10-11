// node --test lib/exam-room-rules.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { clockOffset, formatWait, formatWhen, phaseOf, secondsUntil, sortInvitations, translateRoomError, type Invitation } from './exam-room-rules.ts';

const base: Invitation = {
  roomId: 1,
  accountId: 7,
  simulationId: null,
  joinedAt: null,
  statementId: 3,
  statementTitle: 'Matemática',
  status: 'RUNNING',
  startsAt: '2026-10-12T09:00:00',
  endsAt: '2026-10-12T11:00:00',
  durationMinutes: 45,
  simulationStatus: null,
  serverTime: '2026-10-12T10:00:00',
};

test('a fase segue o estado da sala, a janela e a simulação do aluno', () => {
  assert.equal(phaseOf(base), 'live');
  assert.equal(phaseOf({ ...base, status: 'DRAFT' }), 'scheduled');
  assert.equal(phaseOf({ ...base, status: 'OPEN' }), 'lobby');
  // a decorrer mas antes da hora de abrir: o servidor recusaria entrar
  assert.equal(phaseOf({ ...base, serverTime: '2026-10-12T08:59:00' }), 'lobby');
  assert.equal(phaseOf({ ...base, serverTime: '2026-10-12T11:00:00' }), 'over');
  assert.equal(phaseOf({ ...base, status: 'CLOSED' }), 'over');
  assert.equal(phaseOf({ ...base, simulationId: 5, simulationStatus: 'FINISHED' }), 'submitted');
});

test('o tempo conta pelo relógio do servidor, não pelo do telemóvel', () => {
  // o telemóvel está 10 minutos atrasado em relação ao servidor
  const serverNow = Date.parse('2026-10-12T10:00:00+01:00');
  const phoneNow = serverNow - 10 * 60_000;
  const offset = clockOffset('2026-10-12T10:00:00', phoneNow);
  assert.equal(secondsUntil('2026-10-12T11:00:00', phoneNow, offset), 3600);
  assert.equal(secondsUntil('2026-10-12T09:00:00', phoneNow, offset), 0);
  assert.equal(secondsUntil('lixo', phoneNow, offset), null);
});

test('formatos', () => {
  assert.equal(formatWait(45), '45 s');
  assert.equal(formatWait(61), '2 min');
  assert.equal(formatWait(7500), '2 h 05 min');
  assert.equal(formatWhen('2026-10-12T09:05:00'), '12/10 às 09:05');
});

test('as salas a decorrer aparecem primeiro, as passadas no fim', () => {
  const list = sortInvitations([
    { ...base, roomId: 1, status: 'CLOSED' },
    { ...base, roomId: 2, status: 'DRAFT' },
    { ...base, roomId: 3 },
    { ...base, roomId: 4, status: 'OPEN' },
  ]);
  assert.deepEqual(list.map((i) => i.roomId), [3, 4, 2, 1]);
});

test('os erros da sala chegam em português', () => {
  assert.equal(translateRoomError('The exam room has not started'), 'A sala ainda não começou. Espera pelo professor.');
  assert.equal(translateRoomError('The student is not invited to this room'), 'Não foste convidado para esta sala.');
  assert.equal(translateRoomError('outra coisa'), 'outra coisa');
});
