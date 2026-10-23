import { invitationsErrorOf, phaseOf } from '@/lib/exam-room-rules';
import { listInvitations } from '@/lib/exam-room';
import { SalasDeProva } from '@/components/salas-de-prova';

/** As salas são um painel de apoio: lêem-se em paralelo e não atrasam o feed principal. */
export async function SalasDeProvaSection() {
  const result = await listInvitations();
  const invitations = result.ok ? result.data : [];
  const pending = invitations.filter((inv) => ['live', 'lobby', 'scheduled'].includes(phaseOf(inv)));
  const hidden = invitations.length - pending.length;

  return <div className="grid gap-3 px-4 pt-3 empty:hidden"><SalasDeProva invitations={pending} invitationsError={invitationsErrorOf(result)} hiddenCount={hidden} /></div>;
}
