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

/** As salas que ainda pedem ação, pela ordem em que começam, no máximo `limit`. */
export function upcomingInvitations(invitations: readonly Invitation[], limit = 3): UpcomingInvitation[] {
  return sortInvitations([...invitations])
    .filter((inv) => ['scheduled', 'lobby', 'live'].includes(phaseOf(inv)))
    .slice(0, limit)
    .map((inv) => {
      const when = new Date(parseServerTime(inv.startsAt));
      return {
        key: inv.roomId,
        day: String(when.getDate()),
        month: when.toLocaleDateString('pt-PT', { month: 'short' }).replace('.', ''),
        title: inv.statementTitle ?? 'Sala de prova',
        meta: `${when.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })} · ${inv.durationMinutes} min`,
      };
    });
}
