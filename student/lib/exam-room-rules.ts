// Salas de Prova do aluno (FE-14): o que o convite quer dizer agora, sem rede nem
// React, para o `node --test` o alcançar.
//
// O tempo conta-se pelo `serverTime` que vem com o convite e não pelo relógio do
// telemóvel: um aparelho com a hora errada não pode dizer ao aluno que a sala abre
// daqui a 3 minutos quando já abriu.

import { parseServerTime } from './exam-rules.ts';

export type RoomStatus = 'DRAFT' | 'OPEN' | 'RUNNING' | 'CLOSED';

/** `ExamRoomInvitationResponse` (kixi#195). */
export interface Invitation {
  roomId: number;
  accountId: number;
  simulationId: number | null;
  joinedAt: string | null;
  statementId: number;
  statementTitle: string | null;
  status: RoomStatus;
  startsAt: string;
  endsAt: string;
  durationMinutes: number;
  simulationStatus: string | null;
  serverTime: string;
}

/**
 * - `scheduled`: o professor ainda não abriu a sala
 * - `lobby`: aberta, à espera da hora ou de o professor iniciar; entrar regista a presença
 * - `live`: a decorrer, dentro da janela; entrar começa (ou continua) a prova
 * - `submitted`: o aluno já entregou
 * - `over`: a sala fechou ou a janela acabou
 */
export type Phase = 'scheduled' | 'lobby' | 'live' | 'submitted' | 'over';

export function phaseOf(inv: Invitation): Phase {
  const sim = (inv.simulationStatus ?? '').toUpperCase();
  if (sim === 'FINISHED' || sim === 'CANCELLED') return 'submitted';
  if (inv.status === 'CLOSED') return 'over';
  const now = parseServerTime(inv.serverTime);
  const end = parseServerTime(inv.endsAt);
  if (Number.isFinite(now) && Number.isFinite(end) && now >= end) return 'over';
  if (inv.status === 'DRAFT') return 'scheduled';
  if (inv.status === 'OPEN') return 'lobby';
  const start = parseServerTime(inv.startsAt);
  return Number.isFinite(now) && Number.isFinite(start) && now < start ? 'lobby' : 'live';
}

/** Milissegundos do relógio do browser que somar a `Date.now()` para ter a hora
 *  do servidor. Medido no momento em que o convite chegou. */
export function clockOffset(serverTime: string, receivedAt: number): number {
  const server = parseServerTime(serverTime);
  return Number.isFinite(server) ? server - receivedAt : 0;
}

/** Segundos que faltam para `target`, à hora do servidor; nunca negativo. */
export function secondsUntil(target: string, browserNow: number, offset: number): number | null {
  const at = parseServerTime(target);
  if (!Number.isFinite(at)) return null;
  return Math.max(0, Math.floor((at - (browserNow + offset)) / 1000));
}

/** "2 h 05 min", "12 min", "45 s". */
export function formatWait(seconds: number): string {
  if (seconds < 60) return `${seconds} s`;
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')} min`;
}

/** "12/10 às 09:00", a hora de parede que o servidor mandou, sem passar por fuso. */
export function formatWhen(value: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  return m ? `${m[3]}/${m[2]} às ${m[4]}:${m[5]}` : value;
}

/** As que importam primeiro: a decorrer, depois na sala de espera, por abrir, e as passadas no fim. */
export function sortInvitations(list: Invitation[]): Invitation[] {
  const rank: Record<Phase, number> = { live: 0, lobby: 1, scheduled: 2, submitted: 3, over: 4 };
  return [...list].sort((a, b) => rank[phaseOf(a)] - rank[phaseOf(b)] || a.startsAt.localeCompare(b.startsAt));
}

const ROOM_ERRORS: [RegExp, string][] = [
  [/not invited/i, 'Não foste convidado para esta sala.'],
  [/has not started/i, 'A sala ainda não começou. Espera pelo professor.'],
  [/has ended/i, 'A janela desta sala já terminou.'],
  [/not open/i, 'A sala ainda não abriu.'],
  [/not accepting answers/i, 'A sala não está a aceitar respostas agora.'],
  [/exam room not found/i, 'Não encontrámos esta sala.'],
];

export function translateRoomError(message: string): string {
  return ROOM_ERRORS.find(([pattern]) => pattern.test(message))?.[1] ?? message;
}
