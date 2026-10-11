'use client';

import { useCallback, useEffect, useState } from 'react';
import { DoorOpen, Play, Square, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DetailSkeleton } from '@/components/crud/loading';
import { Confirm, type ConfirmState } from '@/components/crud/confirm';
import { changeRoomStatus, getRoom, inviteRoomClass, type StatementChoice } from '@/app/actions/exam-rooms';
import {
  formatCountdown,
  formatWall,
  luandaNowInput,
  PARTICIPANT_LABEL,
  participantName,
  roomActions,
  type ExamRoom,
  type RoomAction,
} from '@/lib/exam-rooms/model';
import { RoomHead, RoomStatusBadge } from './room-head';
import { RoomResults } from './room-results';
import { useRoomLive } from './use-room-live';

const CONFIRM: Record<RoomAction, Omit<ConfirmState, 'run'>> = {
  open: {
    title: 'Abrir a sala?',
    description: 'Os alunos convidados passam a ver a sala e podem entrar na sala de espera. A prova só começa quando a iniciar.',
    action: 'Abrir sala',
  },
  start: {
    title: 'Iniciar a prova?',
    description: 'Os alunos que entrarem a partir de agora começam a responder, com o tempo a contar.',
    action: 'Iniciar prova',
  },
  close: {
    title: 'Encerrar a sala?',
    description: 'Quem ainda estiver a responder é submetido automaticamente com o que respondeu, e as notas ficam lançadas. Não dá para reabrir.',
    action: 'Encerrar',
    destructive: true,
  },
};

type Loaded = { room: ExamRoom; statement: StatementChoice | null; classLabel: string | null };

export function RoomConsole({ id }: { id: number }) {
  const [data, setData] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [now, setNow] = useState(() => luandaNowInput());

  const load = useCallback(async () => {
    const res = await getRoom(id);
    if (res.ok) {
      setData(res.data);
      setError(null);
    } else setError(res.error);
  }, [id]);

  useEffect(() => {
    const task = window.setTimeout(() => void load(), 0);
    const clock = window.setInterval(() => setNow(luandaNowInput()), 15_000);
    return () => {
      window.clearTimeout(task);
      window.clearInterval(clock);
    };
  }, [load]);

  const status = data?.room.status;
  const live = useRoomLive(id, status === 'OPEN' || status === 'RUNNING');

  // O stream traz o estado verdadeiro; se a sala mudou noutro separador, acompanha.
  const liveStatus = live.snapshot?.status;
  const stale = !!liveStatus && !!data && liveStatus !== data.room.status;
  useEffect(() => {
    if (!stale) return;
    const task = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(task);
  }, [stale, load]);

  if (error) return <p className="py-12 text-center text-sm text-destructive">{error}</p>;
  if (!data) return <div className="mx-auto max-w-6xl p-4 md:p-8"><DetailSkeleton /></div>;

  const { room, statement, classLabel } = data;
  // A hora do servidor manda quando a há; o relógio do browser é só o recurso.
  const reference = live.snapshot?.serverTime?.slice(0, 16) ?? now;
  const actions = roomActions(room, reference);
  const title = statement?.title ?? `Enunciado ${room.statementId}`;
  const year = new Date().getFullYear();

  function ask(action: RoomAction) {
    setConfirm({
      ...CONFIRM[action],
      run: async () => {
        setBusy(true);
        const res = await changeRoomStatus(id, action);
        setBusy(false);
        if (!res.ok) return void toast.error(res.error);
        toast.success(action === 'close' ? 'Sala encerrada. As notas estão abaixo.' : action === 'start' ? 'Prova iniciada.' : 'Sala aberta.');
        setData((d) => (d ? { ...d, room: res.data } : d));
      },
    });
  }

  async function invite() {
    if (room.classId == null) return;
    setBusy(true);
    const res = await inviteRoomClass(id, room.classId);
    setBusy(false);
    if (res.ok) toast.success('Turma convidada. Quem já estava convidado não é repetido.');
    else toast.error(res.error);
  }

  const reasons = (Object.keys(actions) as RoomAction[]).map((k) => actions[k].reason).filter(Boolean);

  return (
    <div className="mx-auto max-w-6xl p-4 md:p-8">
      <RoomHead
        title={title}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <RoomStatusBadge status={room.status} />
            <span>{classLabel ?? (room.classId != null ? `Turma ${room.classId}` : '')}</span>
            <span aria-hidden>·</span>
            <span className="tabular-nums">{formatWall(room.startsAt, year)} → {formatWall(room.endsAt, year)} · {room.durationMinutes} min</span>
          </span>
        }
        back={{ href: '/exam-rooms', label: 'Voltar às salas' }}
        actions={
          room.status === 'CLOSED' ? null : (
            <>
              {room.status !== 'RUNNING' ? (
                <Button variant="outline" onClick={invite} disabled={busy || room.classId == null}>
                  <UserPlus size={16} aria-hidden /> Convidar turma
                </Button>
              ) : null}
              {room.status === 'DRAFT' ? (
                <Button onClick={() => ask('open')} disabled={busy || !actions.open.allowed}>
                  <DoorOpen size={16} aria-hidden /> Abrir sala
                </Button>
              ) : null}
              {room.status === 'OPEN' ? (
                <Button onClick={() => ask('start')} disabled={busy || !actions.start.allowed}>
                  <Play size={16} aria-hidden /> Iniciar prova
                </Button>
              ) : null}
              <Button variant="outline" className="text-destructive" onClick={() => ask('close')} disabled={busy || !actions.close.allowed}>
                <Square size={16} aria-hidden /> Encerrar
              </Button>
            </>
          )
        }
      />

      {reasons.length && room.status !== 'CLOSED' ? (
        <p className="-mt-4 mb-6 text-sm text-muted-foreground">{reasons[0]}</p>
      ) : null}

      {room.status === 'CLOSED' ? (
        <RoomResults roomId={id} title={title} totalMaxScore={statement?.totalMaxScore ?? null} />
      ) : room.status === 'DRAFT' ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            A sala está em rascunho: os alunos ainda não a veem. Abra-a quando a turma estiver pronta para entrar.
          </CardContent>
        </Card>
      ) : (
        <LivePanel live={live} running={room.status === 'RUNNING'} />
      )}

      <Confirm state={confirm} onClose={() => setConfirm(null)} />
    </div>
  );
}

function LivePanel({ live, running }: { live: ReturnType<typeof useRoomLive>; running: boolean }) {
  const s = live.snapshot;
  return (
    <section aria-labelledby="live-title" className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="live-title" className="text-lg font-semibold">Ao vivo</h2>
        <span role="status" className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className={`size-2 rounded-full ${live.connection === 'live' ? 'bg-success' : 'bg-warning'}`} aria-hidden />
          {live.connection === 'live' ? 'Ligado, atualiza a cada 2 s' : live.connection === 'retrying' ? 'Ligação perdida, a voltar a ligar…' : 'A ligar…'}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label={running ? 'Tempo restante' : 'Fecha em'} value={live.remaining != null ? formatCountdown(live.remaining) : '…'} strong />
        <Stat label="Entraram" value={s ? `${s.joinedParticipants} de ${s.totalParticipants}` : '…'} />
        <Stat label="Entregaram" value={s ? `${s.submittedParticipants} de ${s.totalParticipants}` : '…'} />
        <Stat label="Progresso" value={s ? `${Math.round(s.progressPercentage)}%` : '…'} />
      </div>

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="font-medium text-muted-foreground">Aluno</TableHead>
                <TableHead className="w-36 font-medium text-muted-foreground">Estado</TableHead>
                <TableHead className="font-medium text-muted-foreground">Respostas</TableHead>
                <TableHead className="hidden w-28 font-medium text-muted-foreground sm:table-cell">Entrou</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!s ? (
                <TableRow><TableCell colSpan={4} className="py-10 text-center text-sm text-muted-foreground">A receber o estado da sala…</TableCell></TableRow>
              ) : s.participants.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="py-10 text-center text-sm text-muted-foreground">Ninguém convidado. Use “Convidar turma”.</TableCell></TableRow>
              ) : (
                s.participants.map((p) => {
                  const pct = p.totalQuestions ? Math.round((p.answeredQuestions / p.totalQuestions) * 100) : 0;
                  return (
                    <TableRow key={p.accountId}>
                      <TableCell className="font-medium">{participantName(p)}</TableCell>
                      <TableCell>
                        <Badge variant={p.status === 'FINISHED' ? 'success' : p.status === 'IN_PROGRESS' ? 'info' : 'secondary'}>
                          {p.status === 'NOT_STARTED' && p.joinedAt ? 'Na sala de espera' : (PARTICIPANT_LABEL[p.status] ?? p.status)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div
                            className="h-2 flex-1 overflow-hidden rounded-full bg-secondary"
                            role="progressbar"
                            aria-valuemin={0}
                            aria-valuemax={p.totalQuestions}
                            aria-valuenow={p.answeredQuestions}
                            aria-label={`${participantName(p)}: ${p.answeredQuestions} de ${p.totalQuestions} respostas`}
                          >
                            <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="w-12 text-right text-xs tabular-nums text-muted-foreground">{p.answeredQuestions}/{p.totalQuestions}</span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden tabular-nums text-muted-foreground sm:table-cell">{p.joinedAt ? formatWall(p.joinedAt).slice(-5) : '—'}</TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </section>
  );
}

function Stat({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`mt-1 font-semibold tabular-nums ${strong ? 'text-3xl' : 'text-xl'}`}>{value}</p>
      </CardContent>
    </Card>
  );
}
