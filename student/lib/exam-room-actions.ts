'use server';

import { forgetVisitedPages } from './refresh';
import { requireStudent } from './guard';
import { joinRoom } from './exam-room';
import { translateRoomError } from './exam-room-rules';
import { redirectFromAction } from './action-redirect';

export type EnterState = { error?: string; waiting?: string } | undefined;

/** Entra numa sala. A decorrer, abre a prova; aberta, regista a presença na sala de
 *  espera e diz ao aluno que espere pelo professor. */
export async function entrarSalaAction(_: EnterState, form: FormData): Promise<EnterState> {
  await requireStudent();
  const roomId = Number(form.get('roomId'));
  if (!Number.isInteger(roomId) || roomId <= 0) return { error: 'Não identificámos a sala.' };

  const joined = await joinRoom(roomId);
  if (!joined.ok) return { error: translateRoomError(joined.message) };
  if (!joined.data.simulationId) {
    return { waiting: 'Estás na sala de espera. A prova começa quando o professor a iniciar.' };
  }
  // Caminho cru: o Next acrescenta o basePath ao redirect de uma server action.
  // `entrada=1` é o sinal de uso único do kixi-frontend#219 ("sala entrada"): a sala
  // é revisitada enquanto a prova controlada continua em curso.
  forgetVisitedPages();
  await redirectFromAction(`/sala/${roomId}?entrada=1`);
}
