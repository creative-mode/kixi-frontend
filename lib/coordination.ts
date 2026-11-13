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

/** Os filtros da lista da coordenação, na ordem em que aparecem. */
export const ROOM_FILTERS = [
  { key: 'todas', label: 'Todas' },
  { key: 'por-rever', label: 'Por rever' },
  { key: 'em-curso', label: 'Em curso' },
  { key: 'rascunhos', label: 'Rascunhos' },
  { key: 'fechadas', label: 'Encerradas' },
] as const;

export type RoomFilter = (typeof ROOM_FILTERS)[number]['key'];

export const DEFAULT_ROOM_FILTER: RoomFilter = 'todas';

export function filterRooms(rooms: readonly CoordinationRoom[], filter: RoomFilter): CoordinationRoom[] {
  if (filter === 'por-rever') return rooms.filter((r) => r.pendingAnswers > 0);
  if (filter === 'em-curso') return rooms.filter((r) => r.status === 'OPEN' || r.status === 'RUNNING');
  if (filter === 'rascunhos') return rooms.filter((r) => r.status === 'DRAFT');
  if (filter === 'fechadas') return rooms.filter((r) => r.status === 'CLOSED');
  return [...rooms];
}

/** Quantos itens cada filtro mostra: os separadores não fazem o utilizador adivinhar o que lá está. */
export function roomCounts(rooms: readonly CoordinationRoom[]): Record<RoomFilter, number> {
  return Object.fromEntries(ROOM_FILTERS.map((f) => [f.key, filterRooms(rooms, f.key).length])) as Record<RoomFilter, number>;
}

type ClassWithInstitution = { code: string; institutionId: number | null };
type InstitutionRow = { id: number; name: string };

/**
 * O nome da instituição por código de turma, para o ADMIN ver a escola de cada sala (#759).
 *
 * O código da turma não é único entre escolas: quando o mesmo código aparece em
 * instituições diferentes, a sala fica sem escola em vez de mostrar a errada.
 */
export function institutionNamesByClassCode(
  classes: readonly ClassWithInstitution[],
  institutions: readonly InstitutionRow[],
): Map<string, string> {
  const names = new Map(institutions.map((i) => [i.id, i.name]));
  const byCode = new Map<string, Set<string>>();
  for (const klass of classes) {
    const name = klass.institutionId === null ? undefined : names.get(klass.institutionId);
    if (!name) continue;
    const found = byCode.get(klass.code) ?? new Set<string>();
    found.add(name);
    byCode.set(klass.code, found);
  }
  return new Map([...byCode].filter(([, found]) => found.size === 1).map(([code, found]) => [code, [...found][0]]));
}
