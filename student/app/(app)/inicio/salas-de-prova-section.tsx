import Link from 'next/link';
import { DoorOpen } from 'lucide-react';
import { invitationsErrorOf, phaseOf } from '@/lib/exam-room-rules';
import { listInvitations } from '@/lib/exam-room';
import { SalasDeProva } from '@/components/salas-de-prova';

/**
 * As salas de prova no topo do Início (#795): a decorrer e na sala de espera, em
 * qualquer tamanho de ecrã — são as únicas que pedem uma acção agora.
 *
 * As que ainda não abriram (`scheduled`) não ganham cartão cheio (#806 — code
 * review): com o atalho do tutor (#804) e o compositor também no topo do Início,
 * um cartão completo por cada sala só marcada para mais tarde — sem nada para o
 * aluno fazer já — empurrava o feed para fora do ecrã. A barra lateral `xl:block`
 * (`Shell.tsx`) também não serve de destino: só aparece a partir dos ~1280px, o
 * que escondia um alerta potencialmente urgente da maioria dos ecrãs de portátil
 * e de todo o telemóvel. Ficam por isso na mesma linha discreta que já existia
 * para "sem salas", juntas às já entregues/terminadas — o aluno não tem nada a
 * fazer nelas enquanto não abrirem, só precisa de saber que existem.
 *
 * A `origem` viaja com a entrada para o evento de analítica saber que veio do Início.
 */
export async function SalasDeProvaSection() {
  const result = await listInvitations();
  const invitations = result.ok ? result.data : [];
  const error = invitationsErrorOf(result);

  // Com erro, mostra sempre o aviso em vez da linha discreta: sem saber o estado
  // das salas não se pode dizer se alguma delas está, na verdade, a decorrer.
  if (error) {
    return <SalasDeProva invitations={[]} invitationsError={error} origem="inicio" />;
  }

  const actionable = invitations.filter((inv) => ['live', 'lobby'].includes(phaseOf(inv)));
  const scheduled = invitations.filter((inv) => phaseOf(inv) === 'scheduled').length;
  const hidden = invitations.length - actionable.length - scheduled;

  if (actionable.length === 0) {
    return (
      <Link
        href="/provas?aba=salas"
        className="flex min-h-9 items-center gap-2 text-[13px] font-semibold text-muted-foreground hover:text-foreground"
      >
        <DoorOpen className="size-4" aria-hidden /> Salas de prova
        {(scheduled > 0 || hidden > 0) && (
          <span className="font-normal">
            · {[
              scheduled > 0 && (scheduled === 1 ? '1 por abrir' : `${scheduled} por abrir`),
              hidden > 0 && (hidden === 1 ? '1 já entregue ou terminada' : `${hidden} já entregues ou terminadas`),
            ].filter(Boolean).join(' · ')}
          </span>
        )}
      </Link>
    );
  }

  return <SalasDeProva invitations={actionable} hiddenCount={hidden} scheduledCount={scheduled} origem="inicio" />;
}
