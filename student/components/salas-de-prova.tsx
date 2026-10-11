'use client';

import { useActionState, useEffect, useState } from 'react';
import { AlarmClock, DoorOpen, Play } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatClock, remainingMs } from '@/lib/exam-rules';
import { canEnter, type RoomPhase } from '@/lib/exam-room-rules';
import { entrarSalaAction, type JoinState } from '@/lib/exam-room-actions';
import type { RoomCard } from '@/lib/exam-rooms';

const PHASE_LABEL: Record<RoomPhase, string> = {
  upcoming: 'Ainda vai começar',
  open: 'A sala está aberta',
  running: 'A decorrer',
  closed: 'Já terminou',
};

/**
 * The «Salas de prova» section: one card per room the student is on.
 *
 * The countdown ticks only once mounted, for the same reason the exam room's does:
 * `Date.now()` during render gives a different value on the server and on the client
 * and React reports the divergence. So the first paint shows the state without the
 * clock and the effect is what makes the time appear.
 *
 * The card's phase comes from the server, not from here: `phaseOf` uses the same
 * window `join` refuses on. A card that said "a decorrer" when the server answers *has
 * not started* would teach the student to distrust the screen.
 */
export function SecaoSalas({ rooms }: { rooms: RoomCard[] }) {
  const [state, formAction, submitting] = useActionState<JoinState, FormData>(entrarSalaAction, undefined);

  if (rooms.length === 0) return null;

  return (
    <Card className="gap-0 py-0">
      <CardHeader className="flex flex-row items-center gap-2.5 pb-3">
        <DoorOpen className="size-4 text-muted-foreground" aria-hidden />
        <h2 className="leading-none font-bold tracking-tight text-base">Salas de prova</h2>
        <span className="ml-auto text-sm text-muted-foreground">{rooms.length}</span>
      </CardHeader>
      <CardContent className="grid gap-0 p-0">
        {rooms.map((room) => (
          <SalaCard key={room.id} room={room} state={state} formAction={formAction} submitting={submitting} />
        ))}
      </CardContent>
    </Card>
  );
}

function SalaCard({
  room,
  state,
  formAction,
  submitting,
}: {
  room: RoomCard;
  state: JoinState;
  formAction: (form: FormData) => void;
  submitting: boolean;
}) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    // Once a second, like the exam room's. Enough for a countdown that shows minutes.
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const id = `sala-${room.id}`;
  const error = state?.roomId === room.id ? state.error : undefined;
  const left = now === null ? null : remainingMs(room.endsAt, now);
  const entering = canEnter(room.phase);

  return (
    <div className="flex flex-wrap items-center gap-3 border-t px-5 py-3.5">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <b className="leading-snug">Sala de prova</b>
          <Badge variant={room.phase === 'running' ? 'success' : room.phase === 'closed' ? 'secondary' : 'info'}>
            {PHASE_LABEL[room.phase]}
          </Badge>
          {room.simulationId != null && <Badge variant="outline">Já entraste</Badge>}
        </div>
        <p className="mt-0.5 text-[13px] text-muted-foreground">
          {/* A closed room says so rather than counting down to nothing, and an open
              one says when the paper is released — the distinction the service makes
              between presence and the paper. */}
          {/* Nada aqui é inventado: o convite não traz janela, por isso não há contagem
              nem hora de início para mostrar. «Sem tempo limite» seria uma mentira —
              a prova tem o tempo que o professor deu. */}
          {room.phase === 'running'
            ? left === null
              ? 'A prova está a decorrer. O tempo é o que o teu professor definiu.'
              : `Termina em ${formatClock(left)}.`
            : room.phase === 'closed'
              ? 'Esta prova já acabou.'
              : room.startsAt
                ? `A prova abre às ${clock(room.startsAt)}.`
                : 'Foste convidado. A prova abre quando o teu professor a iniciar.'}
        </p>
        {error && <p role="alert" className="mt-1 text-[13px] font-semibold text-destructive">{error}</p>}
      </div>

      {entering ? (
        <form action={formAction} className="shrink-0">
          <input type="hidden" name="roomId" value={room.id} />
          <Button type="submit" size="sm" disabled={submitting}>
            <Play aria-hidden />{room.simulationId != null ? 'Continuar' : 'Entrar'}
          </Button>
        </form>
      ) : (
        // Só presença: o `join` numa sala OPEN regista o aluno e não cria prova, por
        // isso o botão prometeria uma prova que o servidor não vai dar.
        <span className="inline-flex shrink-0 items-center gap-1.5 text-[13px] font-semibold text-muted-foreground">
          <AlarmClock className="size-4" aria-hidden />Só presença
        </span>
      )}
    </div>
  );
}

function clock(iso: string): string {
  const at = Date.parse(iso);
  if (Number.isNaN(at)) return 'breve';
  return new Date(at).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
}
