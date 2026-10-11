'use server';

import { redirect } from 'next/navigation';
import { requireStudent } from './guard';
import { getMyExamRooms, joinExamRoom } from './exam-rooms';
import { joinMessage } from './exam-room-rules';

export type JoinState = { error?: string; roomId?: number } | undefined;

/**
 * Enter an exam room and send the student to the exam screen (FE-06).
 *
 * The redirect is a raw path on purpose, the same as `iniciarAction`: in a server
 * action the Next client writes this value into `x-action-redirect` and prepends the
 * basePath, so `/aluno/prova/...` here would give `/aluno/aluno/prova/...`. That was
 * the bug of PR #98.
 *
 * There is no redirect for attendance. On an `OPEN` room the service registers the
 * student and creates no simulation, so there is no exam to open: the message says
 * when the paper starts and the student stays where they are.
 */
export async function entrarSalaAction(_: JoinState, form: FormData): Promise<JoinState> {
  await requireStudent();

  const roomId = Number(form.get('roomId'));
  const statementId = Number(form.get('statementId'));
  if (!Number.isInteger(roomId) || roomId <= 0) return { error: 'Não identificámos a sala.' };

  // The window is re-read from the server rather than trusted from the form: the card
  // rendered some seconds ago, and the room may have started or ended since. Reading
  // it again is what lets "ainda não começou" name the real time.
  const rooms = await getMyExamRooms();
  if (rooms.kind === 'unauthorized') redirect('/entrar?reason=session-expired');
  const known = rooms.kind === 'ok' ? rooms.rooms.find((r) => r.id === roomId) : undefined;

  const outcome = await joinExamRoom(roomId, { startsAt: known?.startsAt ?? null });

  if (outcome.kind === 'joined') {
    // A paper exists. The screen is indexed by the statement, as FE-06 already is.
    redirect(`/prova/${Number.isInteger(statementId) && statementId > 0 ? statementId : known?.statementId ?? 0}`);
  }

  return { error: joinMessage(outcome), roomId };
}
