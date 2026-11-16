import Link from 'next/link';
import { DoorOpen } from 'lucide-react';
import { invitationsErrorOf, phaseOf } from '@/lib/exam-room-rules';
import { listInvitations } from '@/lib/exam-room';
import { SalasDeProva } from '@/components/salas-de-prova';

/**
 * As salas de prova no topo do Início (#795): a decorrer, na sala de espera e as
 * que ainda vão abrir, em qualquer tamanho de ecrã.
 *
 * Sem salas abertas ou por abrir, a secção não desaparece: fica uma linha discreta
 * para a aba das salas, onde vivem o calendário e as entregas antigas. A `origem`
 * viaja com a entrada para o evento de analítica saber que veio do Início.
 */
export async function SalasDeProvaSection() {
  const result = await listInvitations();
  const invitations = result.ok ? result.data : [];
  const pending = invitations.filter((inv) => ['live', 'lobby', 'scheduled'].includes(phaseOf(inv)));
  const hidden = invitations.length - pending.length;
  const error = invitationsErrorOf(result);

  if (pending.length === 0 && !error) {
    return (
      <Link
        href="/provas?aba=salas"
        className="flex min-h-9 items-center gap-2 text-[13px] font-semibold text-muted-foreground hover:text-foreground"
      >
        <DoorOpen className="size-4" aria-hidden /> Salas de prova
        {hidden > 0 && (
          <span className="font-normal">
            · {hidden === 1 ? '1 já entregue ou terminada' : `${hidden} já entregues ou terminadas`}
          </span>
        )}
      </Link>
    );
  }

  return <SalasDeProva invitations={pending} invitationsError={error} hiddenCount={hidden} origem="inicio" />;
}
