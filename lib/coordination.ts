import type { CoordinationGrade, CoordinationRoom } from '@/types/coordination';
import { PHASE_LABEL, roomPhase } from './exam-rooms/model.ts';

/** Regras de apresentação das salas da instituição, sem React: ficam testáveis com `node --test`.
 *  O estado apresentado é a fase única (Agendada/A decorrer/Terminada, kixi#592/#750), nunca o
 *  estado gravado cru — o degravar era o que mostrava «A decorrer» fora da janela da sala. */

/** Onde está a sala: o que falta aos alunos e ao professor. */
export function roomProgress(room: Pick<CoordinationRoom, 'participants' | 'finished' | 'pendingAnswers' | 'status' | 'startsAt' | 'endsAt' | 'phase'>, now?: string): string {
  if (room.participants === 0) return 'Sem alunos';
  const base = `${room.finished} de ${room.participants} entregaram`;
  if (room.pendingAnswers > 0) return `${base}; ${room.pendingAnswers} ${room.pendingAnswers === 1 ? 'resposta por rever' : 'respostas por rever'}`;
  return roomPhase(room, now) === 'ENDED' ? `${base}; tudo corrigido` : base;
}

/** O rótulo da fase, para o cartão da sala. */
export function roomPhaseLabel(room: Pick<CoordinationRoom, 'status' | 'startsAt' | 'endsAt' | 'phase'>, now?: string): string {
  return PHASE_LABEL[roomPhase(room, now)];
}

/** Nota 0–20 com uma casa; quem não entregou (ou ainda não tem nota) fica com travessão, nunca com zero. */
export function gradeText(grade: Pick<CoordinationGrade, 'finalScore' | 'status'>): string {
  if (grade.status !== 'FINISHED' || grade.finalScore === null || grade.finalScore === undefined) return '—';
  return grade.finalScore.toLocaleString('pt-PT', { minimumFractionDigits: 0, maximumFractionDigits: 1 });
}

export const gradeStatusLabel = (grade: Pick<CoordinationGrade, 'status' | 'pendingAnswers'>): string => {
  if (grade.status === null) return 'Não entrou';
  if (grade.status === 'IN_PROGRESS') return 'A fazer';
  if (grade.pendingAnswers > 0) return 'Por corrigir';
  return grade.status === 'FINISHED' ? 'Corrigida' : 'Cancelada';
};

/** Salas por rever primeiro (o que precisa do professor), depois as a decorrer, depois as agendadas e terminadas. */
export function roomsByUrgency(rooms: readonly CoordinationRoom[], now?: string): CoordinationRoom[] {
  const phaseOf = (r: CoordinationRoom) => roomPhase(r, now);
  const rank = (r: CoordinationRoom) => (r.pendingAnswers > 0 ? 0 : phaseOf(r) === 'ONGOING' ? 1 : phaseOf(r) === 'SCHEDULED' ? 2 : 3);
  return [...rooms].sort((a, b) => rank(a) - rank(b) || b.id - a.id);
}
