// node --test lib/mock/exam-rooms.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { invitationsOf, join, roomDeadline, studentView, type MockParticipant, type MockRoom } from './exam-rooms.ts';

const NOW = '2026-10-12T10:00:00';
const rooms = (): MockRoom[] => [
  { id: 1, statementId: 3, status: 'RUNNING', startsAt: '2026-10-12T09:50:00', endsAt: '2026-10-12T11:00:00', durationMinutes: 45 },
  { id: 2, statementId: 3, status: 'OPEN', startsAt: '2026-10-12T14:00:00', endsAt: '2026-10-12T15:00:00', durationMinutes: 45 },
  { id: 3, statementId: 3, status: 'CLOSED', startsAt: '2026-10-11T09:00:00', endsAt: '2026-10-11T10:00:00', durationMinutes: 45 },
];
const invited = (): MockParticipant[] => [
  { roomId: 1, accountId: 7, simulationId: null, joinedAt: null },
  { roomId: 2, accountId: 7, simulationId: null, joinedAt: null },
  { roomId: 3, accountId: 7, simulationId: 90, joinedAt: '2026-10-11T09:01:00' },
];

test('os convites trazem o estado, a janela e a hora do servidor, do mais recente para trás', () => {
  const list = invitationsOf(7, rooms(), invited(), () => 'Matemática', () => ({ id: 90, status: 'FINISHED' }), NOW);
  assert.deepEqual(list.map((i) => i.roomId), [3, 2, 1]);
  assert.equal(list[0].simulationStatus, 'FINISHED');
  assert.equal(list[2].simulationStatus, null);
  assert.equal(list[2].serverTime, NOW);
  assert.equal(invitationsOf(8, rooms(), invited(), () => null, () => undefined, NOW).length, 0);
});

test('entrar numa sala a decorrer cria uma simulação, e só uma', () => {
  const r = rooms();
  const p = invited();
  let created = 0;
  const first = join(1, 7, r, p, NOW, () => 500 + ++created);
  const again = join(1, 7, r, p, NOW, () => 500 + ++created);
  assert.ok(first.ok && again.ok);
  assert.equal(first.ok && first.body.simulationId, 501);
  assert.equal(again.ok && again.body.simulationId, 501);
  assert.equal(created, 1);
});

test('aberta mas por iniciar: sala de espera, sem simulação', () => {
  const p = invited();
  const lobby = join(2, 7, rooms(), p, NOW, () => 1);
  assert.ok(lobby.ok);
  assert.equal(lobby.ok && lobby.body.simulationId, null);
  assert.equal(p[1].joinedAt, NOW);
});

test('fechada, não convidado e inexistente', () => {
  const closed = join(3, 7, rooms(), invited(), NOW, () => 1);
  assert.equal(!closed.ok && closed.problem.status, 409);
  const stranger = join(1, 8, rooms(), invited(), NOW, () => 1);
  assert.equal(!stranger.ok && stranger.problem.status, 403);
  const missing = join(9, 7, rooms(), invited(), NOW, () => 1);
  assert.equal(!missing.ok && missing.problem.status, 404);
});

test('a vista do aluno só existe com a sala a decorrer e depois de entrar', () => {
  const r = rooms();
  const p = invited();
  const before = studentView(1, 7, r, p, NOW, () => [1]);
  assert.equal(!before.ok && before.problem.status, 404);
  join(1, 7, r, p, NOW, () => 501);
  const view = studentView(1, 7, r, p, NOW, () => ['q1', 'q2']);
  assert.ok(view.ok);
  assert.deepEqual(view.ok && view.body.questions, ['q1', 'q2']);
  const lobby = studentView(2, 7, r, p, NOW, () => []);
  assert.equal(!lobby.ok && lobby.problem.status, 409);
});

test('o prazo é a duração da sala, sem passar o fecho', () => {
  assert.equal(roomDeadline('2026-10-12T10:00:00', 45, '2026-10-12T11:00:00'), '2026-10-12T10:45:00');
  assert.equal(roomDeadline('2026-10-12T10:30:00', 45, '2026-10-12T11:00:00'), '2026-10-12T11:00:00');
});
