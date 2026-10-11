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
  statementId: number;
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
 * `GET /exam-rooms/mine` answers one `ExamRoomParticipantResponse` per participant:
 * `(roomId, accountId, simulationId, joinedAt)`. **It carries no title, no window and
 * no status**, so the invitation list alone cannot draw a card with "termina em
 * 12:04" — which is what the issue asks for.
 *
 * So this asks the backend for the rooms themselves as well and joins the two by
 * `roomId`. That is the gap the plan documents: `ExamRoomResponse` has everything, but
 * `/mine` does not send it. When `/mine` does, `byRoomId` below stops being needed and
 * this collapses into a single call.
 *
 * Degrades rather than fails: no rooms is a real answer, and a room the backend cannot
 * describe is left out rather than shown with invented times.
 */
export async function getMyExamRooms(): Promise<RoomsResult> {
  const [invitations, rooms] = await Promise.all([
    apiGet<RoomInvitation[]>('/exam-rooms/mine'),
    apiGet<ExamRoom[]>('/exam-rooms/owned'),
  ]);

  if (!invitations.ok) {
    return invitations.status === 401
      ? { kind: 'unauthorized' }
      : { kind: 'error', message: invitations.message };
  }
  const mine = Array.isArray(invitations.data) ? invitations.data : [];

  // `/owned` is the teacher's list; a student gets an empty one. It is only consulted
  // for the room shape, so an empty answer simply means "no room details".
  const described = new Map<number, ExamRoom>();
  if (rooms.ok && Array.isArray(rooms.data)) {
    for (const room of rooms.data) described.set(Number(room.id), room);
  }

  const now = Date.now();
  const cards: RoomCard[] = [];
  for (const invitation of mine) {
    const id = Number(invitation.roomId);
    if (!Number.isInteger(id)) continue;
    const room = described.get(id);
    // Without the room there is no status and no window, so there is no card to draw.
    if (!room || !visible(room.status)) continue;
    cards.push({
      id,
      statementId: Number(room.statementId),
      status: room.status,
      phase: phaseOf(room.status, room.startsAt, room.endsAt, now),
      startsAt: room.startsAt ?? null,
      endsAt: room.endsAt ?? null,
      durationMinutes: room.durationMinutes ?? null,
      simulationId: invitation.simulationId == null ? null : Number(invitation.simulationId),
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
