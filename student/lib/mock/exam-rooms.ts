/**
 * Which rooms a student sees and what `POST /exam-rooms/{id}/join` answers, as
 * `ExamRoomService` states them.
 *
 * Free of `server-only` so `node --test` can reach it — the parity rule in
 * `self-review.js` requires a test whenever the mock changes, and a rule inside
 * `mock/backend.ts` cannot be tested at all.
 *
 * The failure strings are the service's, verbatim. They are what the frontend's
 * `joinOutcome` matches on, so changing one here without changing it there would
 * quietly turn three distinct refusals into one screen.
 */

export type MockRoomStatus = 'DRAFT' | 'OPEN' | 'RUNNING' | 'CLOSED';

export interface MockRoom {
  id: number;
  statementId: number;
  startsAt: string;
  endsAt: string;
  durationMinutes: number;
  status: MockRoomStatus;
  /** Accounts invited. A student not on this list gets 403. */
  invitedAccountIds: number[];
}

export interface MockInvitation {
  roomId: number;
  accountId: number;
  simulationId: number | null;
  joinedAt: string | null;
}

const ISO = (ms: number) => new Date(ms).toISOString();

/** The invitation list: one row per participant, the shape `GET /exam-rooms/mine` sends. */
export function invitationsOf(rooms: MockRoom[], accountId: number): MockInvitation[] {
  const out: MockInvitation[] = [];
  for (const room of rooms) {
    if (!room.invitedAccountIds.includes(accountId)) continue;
    // Attendance only: `joinedAt` set, no simulation. The service leaves the
    // simulation null while the room is OPEN.
    const inProgress = room.status === 'RUNNING';
    out.push({
      roomId: room.id,
      accountId,
      simulationId: inProgress ? room.id * 100 + accountId : null,
      joinedAt: inProgress ? ISO(Date.now()) : null,
    });
  }
  return out;
}

/** `GET /exam-rooms/owned` for a student: empty. It is the teacher's list, and the
 *  student only reads it for the room shape, so an empty answer means "no details". */
export function ownedBy(): never[] {
  return [];
}

export type JoinResult = { status: number; simulationId: number | null; statementId?: number } | { status: number; message: string };

/**
 * `POST /exam-rooms/{id}/join`, with the service's refusals in the service's order.
 *
 * DRAFT and CLOSED first (`not open`), then the OPEN window, then the RUNNING window,
 * then the simulation — which is idempotent, so a student already holding one gets it
 * back instead of a second paper.
 */
export function join(room: MockRoom | undefined, accountId: number, now: number): JoinResult {
  if (!room) return { status: 404, message: 'Exam room not found' };
  if (!room.invitedAccountIds.includes(accountId)) {
    return { status: 403, message: 'The student is not invited to this room' };
  }
  if (room.status === 'CLOSED' || room.status === 'DRAFT') {
    return { status: 409, message: 'The exam room is not open' };
  }
  if (room.status === 'OPEN') {
    if (now >= Date.parse(room.endsAt)) return { status: 409, message: 'The exam room has ended' };
    // Attendance: no simulation, whatever the student does.
    return { status: 200, simulationId: null };
  }
  if (now < Date.parse(room.startsAt)) return { status: 409, message: 'The exam room has not started' };
  if (now >= Date.parse(room.endsAt)) return { status: 409, message: 'The exam room has ended' };
  return { status: 200, simulationId: room.id * 100 + accountId, statementId: room.statementId };
}
