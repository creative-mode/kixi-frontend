/**
 * The rules of an exam room, as `ExamRoomService` states them.
 *
 * Kept free of `server-only` so `node --test` can cover it, the same reason
 * `mock/catalog-page.ts` and `lib/attempt-history.ts` are their own modules:
 * `mock/backend.ts` starts with `import 'server-only'`, which a plain
 * `node --test` cannot resolve, and a rule that cannot be tested is a rule that was
 * once the wrong way round without anybody noticing.
 *
 * Every message and every status below was read in `ExamRoomService.join` and
 * `ExamRoomStudentResponse`, not inferred. They are contract, not copy.
 */

export type ExamRoomStatus = 'DRAFT' | 'OPEN' | 'RUNNING' | 'CLOSED';

/** `ExamRoomParticipantResponse` — what `GET /exam-rooms/mine` answers, one entry per
 *  participant. Note what it does *not* carry: no title, no window, no status. */
export interface RoomInvitation {
  roomId: number;
  simulationId: number | null;
  joinedAt: string | null;
}

/** `ExamRoomResponse` — the full room. `/mine` does not send it, which is why the
 *  card cannot be built from the invitations alone. */
export interface ExamRoom {
  id: number;
  statementId: number;
  classId: number | null;
  startsAt: string | null;
  endsAt: string | null;
  durationMinutes: number | null;
  status: ExamRoomStatus;
}

/**
 * What happened when the student pressed "entrar".
 *
 * The six cases are the six the service distinguishes. Folding them into one
 * "não podes entrar" takes away exactly what the student needs to know: whether the
 * room is still to come, whether they are late, or whether it is over.
 */
export type JoinOutcome =
  /** Entered, and there is a paper to do: `simulationId` is the simulation the
   *  service created or reused. */
  | { kind: 'joined'; simulationId: number }
  /** Attendance only. `OPEN` is the room being open and the paper not yet released —
   *  the service returns a null `simulationId` and creates no simulation. */
  | { kind: 'attendance'; startsAt: string | null }
  /** `DRAFT` or `CLOSED`. */
  | { kind: 'notOpen' }
  /** `RUNNING`, but `now` is before `startsAt`. */
  | { kind: 'notStarted'; startsAt: string | null }
  /** Past `endsAt`. */
  | { kind: 'ended' }
  /** The invitation points at a simulation that was deleted. Entering will never
   *  resolve this; only a teacher can fix it. */
  | { kind: 'staleInvitation' }
  /** The account is not on the invitation list. */
  | { kind: 'notInvited' }
  /** The room does not exist. */
  | { kind: 'missing' }
  /** 401: the session is gone. */
  | { kind: 'unauthorized' }
  /** Anything else. */
  | { kind: 'error'; message: string };

/** The exact strings `ExamRoomService.join` answers with. Matching on them is
 *  reading the service, not guessing at a catalogue: each one appears once. */
const MESSAGES = {
  notOpen: 'The exam room is not open',
  notStarted: 'The exam room has not started',
  ended: 'The exam room has ended',
  stale: 'The room invitation points to a deleted simulation',
  notInvited: 'The student is not invited to this room',
  missing: 'Exam room not found',
} as const;

/** Turn an answer from `POST /exam-rooms/{id}/join` into what the screen shows.
 *
 *  The message decides the case, because the status cannot: three of the failures are
 *  409 and differ only in wording. A status-only switch would collapse "ainda não
 *  abriu", "ainda não começou" and "já acabou" into one screen, which is the mistake
 *  this function exists to prevent.
 */
export function joinOutcome(
  status: number,
  message: string,
  invitation: { simulationId: number | null } | null,
  room: { startsAt: string | null } | null,
): JoinOutcome {
  if (status === 401) return { kind: 'unauthorized' };
  if (status === 403) return { kind: 'notInvited' };
  if (status === 404) return { kind: 'missing' };

  const startsAt = room?.startsAt ?? null;
  if (message === MESSAGES.notOpen) return { kind: 'notOpen' };
  if (message === MESSAGES.notStarted) return { kind: 'notStarted', startsAt };
  if (message === MESSAGES.ended) return { kind: 'ended' };
  if (message === MESSAGES.stale) return { kind: 'staleInvitation' };
  if (message === MESSAGES.missing) return { kind: 'missing' };

  // 200: a simulation means there is a paper. Its absence means attendance only —
  // the service returns a null simulationId while the room is OPEN.
  const id = invitation?.simulationId ?? null;
  return id == null ? { kind: 'attendance', startsAt } : { kind: 'joined', simulationId: id };
}

/** Whether the student may be offered the room at all.
 *
 *  A `DRAFT` room is a teacher's draft: it is on the invitation list but nothing has
 *  been announced, and showing the student a countdown to a room that does not
 *  exist yet would be worse than showing nothing.
 */
export function visible(status: ExamRoomStatus): boolean {
  return status === 'OPEN' || status === 'RUNNING' || status === 'CLOSED';
}

/** The state a card is in, from what the student can see.
 *
 *  A room that has not started is not "closed" — the student is early, and telling
 *  them it ended loses the one thing they can act on.
 */
export type RoomPhase = 'upcoming' | 'open' | 'running' | 'closed';

export function phaseOf(status: ExamRoomStatus, startsAt: string | null, endsAt: string | null, now: number): RoomPhase {
  if (status === 'DRAFT') return 'closed';
  if (status === 'CLOSED') return 'closed';
  if (status === 'OPEN') return 'open';
  // RUNNING: the service refuses before startsAt and after endsAt, so the card has to
  // agree with it or the student is told to enter and then gets a 409.
  if (startsAt && !Number.isNaN(Date.parse(startsAt)) && Date.parse(startsAt) > now) return 'upcoming';
  if (endsAt && !Number.isNaN(Date.parse(endsAt)) && Date.parse(endsAt) <= now) return 'closed';
  return 'running';
}

/** Only a running room can be entered. `OPEN` is attendance, and joining it twice
 *  does not start the paper — so the button on an OPEN card must not promise one. */
export function canEnter(phase: RoomPhase): boolean {
  return phase === 'running';
}

/** The Portuguese the student reads. Six distinct cases, six distinct sentences:
 *  merging them is what turns a clear message into "não podes entrar". */
export function joinMessage(outcome: JoinOutcome): string {
  switch (outcome.kind) {
    case 'notInvited':
      return 'Não estás convidado para esta prova.';
    case 'notOpen':
      return 'Esta prova ainda não está aberta.';
    case 'notStarted':
      return outcome.startsAt ? `Esta prova começa às ${clock(outcome.startsAt)}.` : 'Esta prova ainda não começou.';
    case 'ended':
      return 'Esta prova já acabou.';
    case 'staleInvitation':
      return 'Não consegues entrar nesta prova. Fala com o teu professor.';
    case 'missing':
      return 'Esta prova não existe.';
    default:
      return 'Não foi possível entrar. Tenta outra vez.';
  }
}

function clock(iso: string): string {
  const at = Date.parse(iso);
  if (Number.isNaN(at)) return 'agora';
  return new Date(at).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
}
