import 'server-only';

import { apiGet, apiPost } from './api';
import {
  joinOutcome,
  phaseOf,
  visible,
  type ExamRoom,
  type ExamRoomStatus,
  type JoinOutcome,
  type RoomInvitation,
  type RoomPhase,
} from './exam-room-rules';

/**
 * A card as the screen draws it.
 *
 * `phase` is computed here rather than in the component so the button, the countdown
 * and the sentence cannot disagree about the same room. It agrees with the server by
 * construction: `phaseOf` uses the same window the service refuses on.
 */
export interface RoomCard {
  id: number;
  /** The paper the room holds. Null while the backend does not say — the invitation
   *  carries no `statementId`, so a card without one is honest and a card with a
   *  guessed one is a link to the wrong exam. */
  statementId: number | null;
  status: ExamRoomStatus;
  phase: RoomPhase;
  startsAt: string | null;
  endsAt: string | null;
  durationMinutes: number | null;
  /** The student's own attempt, if the room already made one. `attendance` on OPEN. */
  simulationId: number | null;
  joined: boolean;
}

export type RoomsResult =
  | { kind: 'ok'; rooms: RoomCard[] }
  | { kind: 'unauthorized' }
  | { kind: 'error'; message: string };

/**
 * The rooms this student is on the invitation list of.
 *
 * **What the backend can and cannot answer, read in `ExamRoomController`:**
 *
 * - `GET /exam-rooms/mine` → `ExamRoomParticipantResponse` per participant:
 *   `(roomId, accountId, simulationId, joinedAt)`. No title, no window, no status.
 * - `GET /exam-rooms/owned` → the **teacher's** list; `ExamRoomController.owned`
 *   gates it on ADMIN or TEACHER and returns an empty stream to anyone else. It is
 *   useless here — a first version of this asked it for the room shape and got an
 *   empty list back, which silently emptied the whole screen.
 * - `GET /exam-rooms/{id}/student` → has `status`, `startsAt`, `endsAt` and
 *   `durationMinutes`, but `ExamRoomService.studentView` only answers when the room
 *   is `RUNNING` and inside the window. Outside that it is a 409, which is exactly
 *   when a student most needs to see that the room exists.
 *
 * So there is **no route** that gives a student the state of a room that has not
 * started. The card therefore says what it knows for certain — that the student is on
 * the invitation list, and whether they already hold a simulation — and does not
 * invent a phase, a countdown or a title it was not told. The gap is `status`,
 * `startsAt` and `endsAt` on the invitation; until the backend sends them, the
 * section cannot promise the countdown the issue asks for, and pretending otherwise
 * would be a screen that lies.
 */
export async function getMyExamRooms(): Promise<RoomsResult> {
  const invitations = await apiGet<RoomInvitation[]>('/exam-rooms/mine');

  if (!invitations.ok) {
    return invitations.status === 401
      ? { kind: 'unauthorized' }
      : { kind: 'error', message: invitations.message };
  }
  const mine = Array.isArray(invitations.data) ? invitations.data : [];

  const cards: RoomCard[] = [];
  const seen = new Set<number>();
  for (const invitation of mine) {
    const id = Number(invitation.roomId);
    if (!Number.isInteger(id) || seen.has(id)) continue;
    seen.add(id);
    const simulationId = invitation.simulationId == null ? null : Number(invitation.simulationId);
    // A simulation means the room was RUNNING and the paper was released. That is the
    // one state the invitation can prove, and it is the one the student can act on.
    cards.push({
      id,
      statementId: null,
      status: simulationId == null ? 'OPEN' : 'RUNNING',
      phase: simulationId == null ? 'open' : 'running',
      startsAt: null,
      endsAt: null,
      durationMinutes: null,
      simulationId,
      joined: Boolean(invitation.joinedAt),
    });
  }

  return { kind: 'ok', rooms: cards };
}

/**
 * Enter a room.
 *
 * `POST /exam-rooms/{id}/join` is idempotent about the simulation: a student who
 * already has one gets it back rather than a second paper. It is not idempotent about
 * `joinedAt`, which the service stamps again on an OPEN room — harmless, and not
 * worth a second round trip to avoid.
 *
 * A student could in principle hold invitations to two rooms over the same statement.
 * The service keys simulations by room and account, so each room gets its own paper;
 * that is the server's rule and this does not second-guess it.
 */
export async function joinExamRoom(roomId: number, known: { startsAt: string | null }): Promise<JoinOutcome> {
  const result = await apiPost<RoomInvitation>(`/exam-rooms/${roomId}/join`, {});
  if (result.ok) {
    return joinOutcome(200, '', { simulationId: result.data?.simulationId ?? null }, known);
  }
  return joinOutcome(result.status, result.message, null, known);
}
