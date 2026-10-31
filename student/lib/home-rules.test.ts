import assert from 'node:assert/strict';
import { test } from 'node:test';
import { upcomingInvitations } from './home-rules.ts';
import type { Invitation } from './exam-room-rules.ts';

const base = {
  accountId: 3,
  simulationId: null,
  joinedAt: null,
  statementId: 1,
  durationMinutes: 45,
  simulationStatus: null,
  serverTime: '2026-10-31T09:00:00',
};

const inv = (over: Partial<Invitation>): Invitation => ({ ...base, roomId: 1, statementTitle: 'Prova', status: 'RUNNING', startsAt: '2026-10-31T09:00:00', endsAt: '2026-10-31T10:00:00', ...over });

test('só entram as salas que ainda pedem ação, e pela ordem de começo', () => {
  const list = [
    inv({ roomId: 1, statementTitle: 'Atrasada', status: 'CLOSED' }),
    inv({ roomId: 2, statementTitle: 'Agendada', status: 'DRAFT', startsAt: '2026-10-31T11:00:00', endsAt: '2026-10-31T12:00:00' }),
    inv({ roomId: 3, statementTitle: 'A decorrer', status: 'RUNNING', startsAt: '2026-10-31T09:00:00' }),
    inv({ roomId: 4, statementTitle: 'Já entregue', status: 'RUNNING', simulationStatus: 'FINISHED' }),
    inv({ roomId: 5, statementTitle: 'Aberta', status: 'OPEN', startsAt: '2026-10-31T10:00:00', endsAt: '2026-10-31T11:00:00' }),
  ];
  assert.deepEqual(upcomingInvitations(list).map((u) => u.title), ['A decorrer', 'Aberta', 'Agendada']);
});

test('respeita o limite e usa um título de recurso', () => {
  const list = [
    inv({ roomId: 1, statementTitle: null, status: 'RUNNING' }),
    inv({ roomId: 2, status: 'RUNNING', startsAt: '2026-10-31T09:10:00' }),
  ];
  const out = upcomingInvitations(list, 1);
  assert.equal(out.length, 1);
  assert.equal(out[0].key, 1);
  assert.equal(out[0].title, 'Sala de prova');
  assert.equal(out[0].meta, '09:00 · 45 min');
});

test('sem salas não há secção para mostrar', () => {
  assert.deepEqual(upcomingInvitations([]), []);
});
