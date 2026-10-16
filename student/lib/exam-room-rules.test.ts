// node --test lib/exam-room-rules.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { clockOffset, formatWait, formatWhen, joinActionOf, phaseOf, secondsUntil, sortInvitations, translateRoomError, type Invitation } from './exam-room-rules.ts';

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

test('a fase segue o relógio vivo quando ele é dado (#204)', () => {
  // fotografia do servidor às 10:00, sala RUNNING das 09:00 às 11:00
  const at = (h: number, m = 0) => Date.parse(`2026-10-12T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00+01:00`);
  // sem relógio vivo vale a fotografia (primeira renderização)
  assert.equal(phaseOf(base), 'live');
  // com o relógio vivo a fase acompanha a hora real
  assert.equal(phaseOf({ ...base, status: 'OPEN' }, at(8, 59)), 'lobby');
  assert.equal(phaseOf({ ...base, status: 'OPEN' }, at(9, 0)), 'lobby');
  assert.equal(phaseOf({ ...base, status: 'RUNNING' }, at(9, 0)), 'live');
  assert.equal(phaseOf({ ...base, status: 'RUNNING' }, at(11, 0)), 'over');
  assert.equal(phaseOf({ ...base, status: 'RUNNING' }, at(12, 0)), 'over');
});

test('o cartão oferece entrar, continuar, esperar ou nada (#204)', () => {
  const lobby = { ...base, status: 'OPEN' as const };
  const live = { ...base, status: 'RUNNING' as const };
  // ainda não entrou, sala aberta: botão de entrar na espera
  assert.deepEqual(joinActionOf(lobby, 'lobby', false), { kind: 'enter-lobby', roomId: 1 });
  // já entrou (joinedAt), sala por começar: estado, não botão — sem ciclo de cliques
  assert.deepEqual(joinActionOf({ ...lobby, joinedAt: '2026-10-12T09:55:00' }, 'lobby', false), { kind: 'waiting' });
  // a decorrer, sem simulação: entrar na prova
  assert.deepEqual(joinActionOf({ ...live, joinedAt: '2026-10-12T09:55:00' }, 'live', false), { kind: 'enter-live', roomId: 1 });
  // a decorrer, simulação em curso: continuar (link direto, sem reenviar)
  assert.deepEqual(
    joinActionOf({ ...live, joinedAt: '2026-10-12T09:55:00', simulationId: 5, simulationStatus: 'IN_PROGRESS' }, 'live', false),
    { kind: 'continue', roomId: 1 },
  );
  // entregue: ver resultado
  assert.deepEqual(
    joinActionOf({ ...base, simulationId: 5, simulationStatus: 'FINISHED' }, 'submitted', false),
    { kind: 'result', simulationId: 5 },
  );
  // janela passada ou sala fechada/por abrir: nada, mesmo com entrada feita
  assert.deepEqual(joinActionOf({ ...lobby, joinedAt: '2026-10-12T09:55:00' }, 'lobby', true), { kind: 'none' });
  assert.deepEqual(joinActionOf({ ...base, status: 'DRAFT' }, 'scheduled', false), { kind: 'none' });
  assert.deepEqual(joinActionOf({ ...base, status: 'CLOSED' }, 'over', false), { kind: 'none' });
});
