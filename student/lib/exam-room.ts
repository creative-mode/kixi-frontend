import 'server-only';

import { apiGet, apiPost, type Result } from './api';
import {
  getQuestionImages,
  getStatementFull,
  listAnswers,
  loadPaperMeta,
  type RoomData,
  type Simulation,
} from './exam';
import { answeredQuestionIds, orderQuestions, savedAnswerFor, type ExamQuestion } from './exam-rules';
import { phaseOf, translateRoomError, type Invitation, type Phase } from './exam-room-rules';

/** As Salas de Prova do lado do aluno (FE-14), sobre o `ExamRoomController`.
 *
 *  A sala reaproveita a sala de prova do FE-06 (`components/sala-prova.tsx`) em modo
 *  controlado: as questões vêm de `/exam-rooms/{id}/student`, e não de
 *  `/statements/{id}/full`, porque o enunciado de uma sala não tem de estar publicado
 *  no catálogo. O tempo é o da simulação que o servidor criou para a sala. */

/** `GET /exam-rooms/mine`. A falha volta para a página em vez de virar `[]`:
 *  uma secção escondida por um erro é indistinguível de "não há salas", e o
 *  aluno fica à espera de uma sala que não tem como ver (#220). */
export async function listInvitations(): Promise<Result<Invitation[]>> {
  const result = await apiGet<Invitation[]>('/exam-rooms/mine');
  if (!result.ok) return result;
  return Array.isArray(result.data)
    ? result
    : { ok: false, status: 200, message: 'Resposta inesperada do servidor.' };
}

export async function joinRoom(roomId: number): Promise<Result<{ simulationId: number | null }>> {
  return apiPost<{ simulationId: number | null }>(`/exam-rooms/${roomId}/join`, {});
}

/** `ExamRoomStudentResponse`. */
interface StudentView {
  roomId: number;
  simulationId: number;
  status: string;
  startsAt: string;
  endsAt: string;
  durationMinutes: number;
  questions: ExamQuestion[];
}

/** As questões que o aluno vê na sala, sem gabarito. Guardadas um minuto, como o
 *  `/full` do treino: cada resposta guardada volta a ler o tipo da questão. */
const VIEW_TTL_MS = 60_000;
const viewCache = new Map<string, { at: number; data: StudentView }>();

export async function getStudentView(roomId: number, { cached = false } = {}): Promise<Result<StudentView>> {
  const key = String(roomId);
  const hit = viewCache.get(key);
  if (cached && hit && Date.now() - hit.at < VIEW_TTL_MS) return { ok: true, data: hit.data };
  const result = await apiGet<StudentView>(`/exam-rooms/${roomId}/student`);
  if (!result.ok) {
    viewCache.delete(key);
    return result;
  }
  const data = { ...result.data, questions: orderQuestions(result.data.questions ?? []) };
  viewCache.set(key, { at: Date.now(), data });
  return { ok: true, data };
}

export type ControlledRoom =
  | { kind: 'open'; data: RoomData }
  /** A prova não está a decorrer: a página diz porquê e manda para as salas. */
  | { kind: 'waiting'; phase: Phase; invitation: Invitation }
  /** Já entregou: vai para o resultado, sem refazer. */
  | { kind: 'submitted'; simulationId: number }
  | { kind: 'missing' }
  | { kind: 'unauthorized' }
  | { kind: 'error'; message: string };

export async function getControlledRoom(roomId: number): Promise<ControlledRoom> {
  const probe = await apiGet<Invitation[]>('/exam-rooms/mine');
  if (!probe.ok) {
    return probe.status === 401 ? { kind: 'unauthorized' } : { kind: 'error', message: translateRoomError(probe.message) };
  }
  const invitation = probe.data.find((i) => i.roomId === roomId);
  if (!invitation) return { kind: 'missing' };

  const phase = phaseOf(invitation);
  if (phase === 'submitted' && invitation.simulationId) return { kind: 'submitted', simulationId: invitation.simulationId };
  if (phase !== 'live') return { kind: 'waiting', phase, invitation };

  // Entrar é idempotente: a primeira vez cria a simulação da sala, as seguintes
  // devolvem a mesma. É o que torna seguro recarregar a página a meio da prova.
  const joined = await joinRoom(roomId);
  if (!joined.ok) return { kind: 'error', message: translateRoomError(joined.message) };
  const simulationId = Number(joined.data.simulationId);
  if (!Number.isInteger(simulationId) || simulationId <= 0) {
    return { kind: 'waiting', phase: 'lobby', invitation };
  }

  const [simulation, view, answers, statement] = await Promise.all([
    apiGet<Simulation>(`/simulations/${simulationId}`),
    getStudentView(roomId),
    listAnswers(),
    // O enunciado de uma sala pode não estar no catálogo: se não abrir, a folha leva o molde em branco.
    getStatementFull(invitation.statementId, { cached: true }),
  ]);
  if (!simulation.ok) return { kind: 'error', message: translateRoomError(simulation.message) };
  if ((simulation.data.status ?? '').toUpperCase() !== 'IN_PROGRESS') return { kind: 'submitted', simulationId };
  if (!view.ok) return { kind: 'error', message: translateRoomError(view.message) };

  const questions = view.data.questions;
  const saved: RoomData['saved'] = {};
  for (const question of questions) {
    const found = savedAnswerFor(answers, simulationId, question.id);
    if (found) saved[question.id] = { answerId: found.id, optionId: Number(found.selectedOptionId) || null, text: found.answerText ?? '' };
  }
  const images: RoomData['images'] = {};
  await Promise.all(questions.map(async (q) => { images[q.id] = await getQuestionImages(q.id); }));

  return {
    kind: 'open',
    data: {
      simulationId,
      roomId,
      status: simulation.data.status ?? null,
      statementId: invitation.statementId,
      deadline: simulation.data.deadline ?? null,
      title: invitation.statementTitle || 'Sala de prova',
      subtitle: `Sala de prova · ${invitation.durationMinutes} min`,
      paper: statement.ok
        ? { ...(await loadPaperMeta(statement.data)), durationMinutes: invitation.durationMinutes }
        : { kind: 'Prova', durationMinutes: invitation.durationMinutes },
      questions,
      images,
      saved,
      answered: [...answeredQuestionIds(answers, simulationId)],
    },
  };
}
