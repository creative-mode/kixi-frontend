'use client';

import { useActionState, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Clock, DoorOpen } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { entrarSalaAction } from '@/lib/exam-room-actions';
import {
  clockOffset,
  formatWait,
  formatWhen,
  joinActionOf,
  phaseOf,
  secondsUntil,
  sortInvitations,
  type Invitation,
  type Phase,
} from '@/lib/exam-room-rules';

const BADGE: Record<Phase, { label: string; variant: 'success' | 'warning' | 'secondary' | 'outline' }> = {
  live: { label: 'A decorrer', variant: 'success' },
  lobby: { label: 'Aberta', variant: 'warning' },
  scheduled: { label: 'Por abrir', variant: 'secondary' },
  submitted: { label: 'Entregue', variant: 'outline' },
  over: { label: 'Terminou', variant: 'outline' },
};

/** A secção "Salas de prova": as provas controladas para que o professor convidou o
 *  aluno. Só aparece quando há convites; com erro, aparece o aviso em vez de nada. */
export function SalasDeProva({ invitations, invitationsError, hiddenCount = 0 }: {
  invitations: Invitation[];
  invitationsError?: { message: string; status: number | null } | null;
  hiddenCount?: number;
}) {
  // O relógio só arranca depois de montar: `Date.now()` no render diferia entre o
  // servidor e o browser, e o React acusava a divergência na hidratação.
  const [now, setNow] = useState<number | null>(null);
  const [receivedAt, setReceivedAt] = useState<number | null>(null);
  useEffect(() => {
    const first = Date.now();
    setReceivedAt(first);
    setNow(first);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, []);

  if (invitations.length === 0) {
    if (!invitationsError) return hiddenCount > 0 ? <p className="text-[13px] text-muted-foreground">{hiddenCount === 1 ? '1 sala já entregue ou terminada' : `${hiddenCount} salas já entregues ou terminadas`} · <Link href="/provas" className="font-semibold text-primary hover:underline">ver em Provas</Link></p> : null;
    return (
      <section aria-labelledby="salas-title" className="grid gap-3">
        <h2 id="salas-title" className="flex items-center gap-2 text-lg font-bold"><DoorOpen className="size-5" aria-hidden /> Salas de prova</h2>
        <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-foreground">{invitationsError.message}</p>
        {invitationsError.status === 401 ? (
          <Button asChild variant="outline" className="justify-self-start">
            <Link href="/entrar">Entrar de novo</Link>
          </Button>
        ) : (
          <RefreshRoomsButton />
        )}
      </section>
    );
  }
  const list = sortInvitations(invitations);

  return (
    <section id="salas" aria-labelledby="salas-title" className="grid gap-3">
      <h2 id="salas-title" className="flex items-center gap-2 text-lg font-bold"><DoorOpen className="size-5" aria-hidden /> Salas de prova</h2>
      <ul className="grid gap-3">
        {list.map((inv) => (
          <li key={inv.roomId}>
            <SalaCard inv={inv} now={now} offset={receivedAt === null ? 0 : clockOffset(inv.serverTime, receivedAt)} />
          </li>
        ))}
      </ul>
      {hiddenCount > 0 && <p className="text-[13px] text-muted-foreground">{hiddenCount === 1 ? '1 sala já entregue ou terminada' : `${hiddenCount} salas já entregues ou terminadas`} · <Link href="/provas" className="font-semibold text-primary hover:underline">ver em Provas</Link></p>}
    </section>
  );
}

/** Tentar de novo volta a ler do servidor: a falha foi ao buscar, por isso não há
 *  estado de cliente para repor. Separado para o botão viver fora do cartão. */
function RefreshRoomsButton() {
  const router = useRouter();
  return (
    <Button type="button" variant="outline" className="justify-self-start" onClick={() => router.refresh()}>
      Tentar de novo
    </Button>
  );
}

function SalaCard({ inv, now, offset }: { inv: Invitation; now: number | null; offset: number }) {
  const [state, enter, pending] = useActionState(entrarSalaAction, undefined);
  const router = useRouter();
  // A fase segue o relógio vivo depois de montar: com o snapshot do servidor, a
  // sala que abriu às 10:00 continuava "por abrir" às 10:01 e o botão nunca
  // mudava de rótulo (#204). Com `now` nulo vale o snapshot (hidratação igual).
  const phase = now === null ? phaseOf(inv) : phaseOf(inv, now + offset);
  const toStart = now === null ? null : secondsUntil(inv.startsAt, now, offset);
  const toEnd = now === null ? null : secondsUntil(inv.endsAt, now, offset);
  const started = toStart === 0;
  const ended = toEnd === 0;

  // A entrada correu bem mas a página ainda mostra o convite antigo: volta a ler
  // do servidor para o cartão refletir o `joinedAt` novo em vez de depender só
  // do estado da ação. Corre uma vez por entrada (o valor não muda a seguir).
  useEffect(() => {
    if (state?.waiting) router.refresh();
  }, [state?.waiting, router]);

  let when: string;
  if (phase === 'submitted') when = 'Já entregaste esta prova.';
  else if (phase === 'over' || ended) when = `Terminou ${formatWhen(inv.endsAt)}.`;
  else if (phase === 'live') when = toEnd === null ? `Fecha ${formatWhen(inv.endsAt)}.` : `Fecha dentro de ${formatWait(toEnd)}.`;
  else if (!started && toStart !== null) when = `Começa dentro de ${formatWait(toStart)} (${formatWhen(inv.startsAt)}).`;
  else when = phase === 'scheduled' ? 'O professor ainda não abriu a sala.' : 'À espera de o professor iniciar a prova.';

  const action = joinActionOf(inv, phase, ended);

  return (
    <Card className="grid gap-3 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold">{inv.statementTitle ?? `Prova ${inv.statementId}`}</p>
          <p className="text-sm text-muted-foreground">{inv.durationMinutes} min · tempo fixo, sem refazer</p>
        </div>
        <Badge variant={BADGE[ended && phase !== 'submitted' ? 'over' : phase].variant}>{BADGE[ended && phase !== 'submitted' ? 'over' : phase].label}</Badge>
      </div>
      <p className="flex items-center gap-2 text-sm" role="status" aria-live="polite">
        <Clock className="size-4 shrink-0 text-muted-foreground" aria-hidden />{when}
      </p>
      {state?.error ? <p role="alert" className="text-sm text-destructive">{state.error}</p> : null}
      {action.kind === 'result' ? (
        <Button asChild variant="outline" className="justify-self-start">
          <Link href={`/resultado?prova=${action.simulationId}`}>Ver resultado</Link>
        </Button>
      ) : action.kind === 'continue' ? (
        <Button asChild className="justify-self-start">
          <Link href={`/sala/${action.roomId}`}>Continuar a prova</Link>
        </Button>
      ) : action.kind === 'waiting' ? (
        <p role="status" className="text-sm text-muted-foreground">Estás na sala de espera. A prova começa quando o professor a iniciar.</p>
      ) : action.kind === 'enter-live' || action.kind === 'enter-lobby' ? (
        <form action={enter} className="justify-self-start">
          <input type="hidden" name="roomId" value={inv.roomId} />
          <Button type="submit" disabled={pending}>
            {pending ? 'A entrar…' : action.kind === 'enter-live' ? 'Entrar na prova' : 'Entrar na sala de espera'}
          </Button>
        </form>
      ) : null}
    </Card>
  );
}
