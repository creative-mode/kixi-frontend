/** Os próximos compromissos que o início mostra na coluna da direita e, no
 *  telemóvel, na secção recolhível (#493). Puro para o `node --test` o alcançar;
 *  a decisão de que salas contam continua em `phaseOf`, e as datas são do servidor. */

import { parseServerTime } from './exam-rules.ts';
import { phaseOf, sortInvitations, type Invitation } from './exam-room-rules.ts';

export interface UpcomingInvitation {
  key: number;
  day: string;
  month: string;
  title: string;
  meta: string;
}

/** Meses como o pt-PT os abrevia, sem depender do fuso do browser: a data do
 *  backend é um `LocalDateTime` e tem de ser lida como o relógio do servidor. */
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/** Dia, mês e hora de um `LocalDateTime` sem fuso, pelo texto, para o ecrã não
 *  mudar de hora conforme o computador do aluno (CI em UTC, escola em Lisboa). */
function wallClockOf(value: string): { day: string; month: string; time: string } {
  const match = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(value.trim());
  if (match) {
    const month = MESES[Number(match[2]) - 1];
    if (month) return { day: String(Number(match[3])), month, time: `${match[4]}:${match[5]}` };
  }
  // Uma data com fuso (ou fora do formato) ainda tem de aparecer: usa-se o
  // parser do resto da app e o fuso do browser, como último recurso.
  const when = new Date(parseServerTime(value));
  return {
    day: String(when.getDate()),
    month: when.toLocaleDateString('pt-PT', { month: 'short' }).replace('.', ''),
    time: when.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }),
  };
}

/** As salas que ainda pedem ação, pela ordem em que começam, no máximo `limit`. */
export function upcomingInvitations(invitations: readonly Invitation[], limit = 3): UpcomingInvitation[] {
  return sortInvitations([...invitations])
    .filter((inv) => ['scheduled', 'lobby', 'live'].includes(phaseOf(inv)))
    .slice(0, limit)
    .map((inv) => {
      const when = wallClockOf(inv.startsAt);
      return {
        key: inv.roomId,
        day: when.day,
        month: when.month,
        title: inv.statementTitle ?? 'Sala de prova',
        meta: `${when.time} · ${inv.durationMinutes} min`,
      };
    });
}
