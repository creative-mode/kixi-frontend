import type { CoordinationGrade, CoordinationRoom } from '@/types/coordination';

/** Regras de apresentação das salas da instituição, sem React: ficam testáveis com `node --test`. */

export const ROOM_STATUS_LABEL: Record<CoordinationRoom['status'], string> = {
  DRAFT: 'Rascunho',
  OPEN: 'Aberta',
  RUNNING: 'A decorrer',
  CLOSED: 'Fechada',
};

/** Onde está a sala: o que falta aos alunos e ao professor. */
export function roomProgress(room: Pick<CoordinationRoom, 'participants' | 'finished' | 'pendingAnswers' | 'status'>): string {
  if (room.participants === 0) return 'Sem alunos';
  const base = `${room.finished} de ${room.participants} entregaram`;
  if (room.pendingAnswers > 0) return `${base}; ${room.pendingAnswers} ${room.pendingAnswers === 1 ? 'resposta por rever' : 'respostas por rever'}`;
  return room.status === 'CLOSED' ? `${base}; tudo corrigido` : base;
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

/** Salas por rever primeiro (o que precisa do professor), depois as a decorrer, depois as fechadas e corrigidas. */
export function roomsByUrgency(rooms: readonly CoordinationRoom[]): CoordinationRoom[] {
  const rank = (r: CoordinationRoom) => (r.pendingAnswers > 0 ? 0 : r.status === 'RUNNING' || r.status === 'OPEN' ? 1 : r.status === 'DRAFT' ? 2 : 3);
  return [...rooms].sort((a, b) => rank(a) - rank(b) || b.id - a.id);
}
