'use client';

import { useActionState, useEffect, useState } from 'react';
import Link from 'next/link';
import { Clock, DoorOpen } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { entrarSalaAction } from '@/lib/exam-room-actions';
import {
  clockOffset,
  formatWait,
  formatWhen,
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
 *  aluno. Só aparece quando há convites. */
export function SalasDeProva({ invitations }: { invitations: Invitation[] }) {
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

  if (invitations.length === 0) return null;
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
    </section>
  );
}

function SalaCard({ inv, now, offset }: { inv: Invitation; now: number | null; offset: number }) {
  const [state, enter, pending] = useActionState(entrarSalaAction, undefined);
  const phase = phaseOf(inv);
  const toStart = now === null ? null : secondsUntil(inv.startsAt, now, offset);
  const toEnd = now === null ? null : secondsUntil(inv.endsAt, now, offset);
  // A fase calculada no servidor envelhece: a sala que abria às 10:00 está aberta às 10:01.
  const started = toStart === 0;
  const ended = toEnd === 0;

  let when: string;
  if (phase === 'submitted') when = 'Já entregaste esta prova.';
  else if (phase === 'over' || ended) when = `Terminou ${formatWhen(inv.endsAt)}.`;
  else if (phase === 'live') when = toEnd === null ? `Fecha ${formatWhen(inv.endsAt)}.` : `Fecha dentro de ${formatWait(toEnd)}.`;
  else if (!started && toStart !== null) when = `Começa dentro de ${formatWait(toStart)} (${formatWhen(inv.startsAt)}).`;
  else when = phase === 'scheduled' ? 'O professor ainda não abriu a sala.' : 'À espera de o professor iniciar a prova.';

  const canEnter = (phase === 'live' || phase === 'lobby') && !ended;
  const continuing = phase === 'live' && (inv.simulationStatus ?? '').toUpperCase() === 'IN_PROGRESS';

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
      {state?.waiting ? <p role="status" className="text-sm text-muted-foreground">{state.waiting}</p> : null}
      {phase === 'submitted' && inv.simulationId ? (
        <Button asChild variant="outline" className="justify-self-start">
          <Link href={`/resultado?prova=${inv.simulationId}`}>Ver resultado</Link>
        </Button>
      ) : canEnter ? (
        <form action={enter} className="justify-self-start">
          <input type="hidden" name="roomId" value={inv.roomId} />
          <Button type="submit" disabled={pending}>
            {pending ? 'A entrar…' : continuing ? 'Continuar a prova' : phase === 'live' ? 'Entrar na prova' : 'Entrar na sala de espera'}
          </Button>
        </form>
      ) : null}
    </Card>
  );
}
