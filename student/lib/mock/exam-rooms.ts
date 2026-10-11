// Salas de Prova do lado do aluno, com as regras do ExamRoomService do backend:
// os convites (`GET /exam-rooms/mine`, kixi#195), entrar (`POST /{id}/join`) e a
// vista do aluno (`GET /{id}/student`). Separado do backend.ts para ter testes:
// este ficheiro não importa `server-only` e corre no `node --test`.
//
// As horas são `LocalDateTime` na hora de Luanda, como no backend (TZ no Dockerfile).

export type RoomStatus = 'DRAFT' | 'OPEN' | 'RUNNING' | 'CLOSED';

export type MockRoom = {
  id: number;
  statementId: number;
  status: RoomStatus;
  startsAt: string;
  endsAt: string;
  durationMinutes: number;
};

export type MockParticipant = {
  roomId: number;
  accountId: number;
  simulationId: number | null;
  joinedAt: string | null;
};

export type RoomSimulation = { id: number; status: string };

type Problem = { status: number; detail: string };
export type Outcome<T> = { ok: true; body: T } | { ok: false; problem: Problem };

const ok = <T>(body: T): Outcome<T> => ({ ok: true, body });
const no = (status: number, detail: string): Outcome<never> => ({ ok: false, problem: { status, detail } });

/** `ExamRoomInvitationResponse`. */
export function invitationsOf(
  accountId: number,
  rooms: MockRoom[],
  participants: MockParticipant[],
  titleOf: (statementId: number) => string | null,
  simulationOf: (id: number) => RoomSimulation | undefined,
  now: string,
) {
  return participants
    .filter((p) => p.accountId === accountId)
    .map((p) => ({ p, room: rooms.find((r) => r.id === p.roomId) }))
    .filter((x): x is { p: MockParticipant; room: MockRoom } => x.room !== undefined)
    .sort((a, b) => b.room.id - a.room.id)
    .map(({ p, room }) => ({
      roomId: room.id,
      accountId: p.accountId,
      simulationId: p.simulationId,
      joinedAt: p.joinedAt,
      statementId: room.statementId,
      statementTitle: titleOf(room.statementId),
      status: room.status,
      startsAt: room.startsAt,
      endsAt: room.endsAt,
      durationMinutes: room.durationMinutes,
      simulationStatus: p.simulationId ? (simulationOf(p.simulationId)?.status ?? null) : null,
      serverTime: now,
    }));
}

/**
 * `ExamRoomService.join`. Aberta: regista a presença, sem simulação. A decorrer e
 * dentro da janela: cria (uma vez) a simulação da sala. `createSimulation` é quem
 * acrescenta a linha ao mock; aqui só se decide se pode.
 */
export function join(
  roomId: number,
  accountId: number,
  rooms: MockRoom[],
  participants: MockParticipant[],
  now: string,
  createSimulation: (room: MockRoom) => number,
): Outcome<{ roomId: number; accountId: number; simulationId: number | null; joinedAt: string | null }> {
  const room = rooms.find((r) => r.id === roomId);
  if (!room) return no(404, 'Exam room not found');
  const p = participants.find((x) => x.roomId === roomId && x.accountId === accountId);
  if (!p) return no(403, 'The student is not invited to this room');
  if (room.status === 'CLOSED' || room.status === 'DRAFT') return no(409, 'The exam room is not open');
  if (!(now < room.endsAt)) return no(409, 'The exam room has ended');
  p.joinedAt ??= now;
  if (room.status === 'OPEN') {
    // Na sala de espera a simulação não se mostra: ainda não começou.
    return ok({ roomId, accountId, simulationId: null, joinedAt: p.joinedAt });
  }
  if (now < room.startsAt) return no(409, 'The exam room has not started');
  p.simulationId ??= createSimulation(room);
  return ok({ roomId, accountId, simulationId: p.simulationId, joinedAt: p.joinedAt });
}

/** `ExamRoomService.studentView`: só com a sala a decorrer e dentro da janela. */
export function studentView<Q>(
  roomId: number,
  accountId: number,
  rooms: MockRoom[],
  participants: MockParticipant[],
  now: string,
  questionsOf: (statementId: number) => Q[],
) {
  const room = rooms.find((r) => r.id === roomId);
  if (!room) return no(404, 'Exam room not found');
  if (!(room.status === 'RUNNING' && !(now < room.startsAt) && now < room.endsAt)) {
    return no(409, 'The exam room is not accepting answers');
  }
  const p = participants.find((x) => x.roomId === roomId && x.accountId === accountId);
  if (!p || !p.simulationId) return no(404, 'Exam room not found');
  return ok({
    roomId: room.id,
    simulationId: p.simulationId,
    status: room.status,
    startsAt: room.startsAt,
    endsAt: room.endsAt,
    durationMinutes: room.durationMinutes,
    questions: questionsOf(room.statementId),
  });
}

/** O prazo da simulação da sala: a duração da sala, sem passar o fecho. */
export function roomDeadline(startedAt: string, durationMinutes: number, endsAt: string): string {
  const start = Date.parse(`${startedAt}Z`);
  const byDuration = new Date(start + durationMinutes * 60_000).toISOString().slice(0, 19);
  return byDuration < endsAt ? byDuration : endsAt;
}
