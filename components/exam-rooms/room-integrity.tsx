'use client';

import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, ShieldAlert, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { roomIntegrity } from '@/app/actions/exam-rooms';
import {
  formatWall,
  participantName,
  summarizeIntegrity,
  type RoomIntegrity as RoomIntegrityData,
} from '@/lib/exam-rooms/model';

/** A consola não fecha nem reabre um stream por causa disto: uma atualização lenta
 *  chega, porque o que aqui está muda quando o aluno sai, não a cada segundo. */
const POLL_MS = 20_000;

/**
 * A vista de integridade da sala (#192): quem saiu da prova, quem tentou colar e
 * quem tentou abrir o tutor, com a hora de cada evento.
 *
 * O que conta é a saída, não o regresso — o resumo soma os pares e mostra os
 * eventos por ordem. E é uma nota para o professor, não uma acusação: o próprio
 * ecrã diz que isto não substitui supervisão. Um aluno pode ter perdido o foco por
 * uma notificação; o que o professor faz com isso é dele.
 */
export function RoomIntegrity({ roomId }: { roomId: number }) {
  const [data, setData] = useState<RoomIntegrityData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const res = await roomIntegrity(roomId);
    setLoading(false);
    if (res.ok) {
      setData(res.data);
      setError(null);
    } else setError(res.error);
  }, [roomId]);

  useEffect(() => {
    const task = window.setTimeout(() => void load(), 0);
    const clock = window.setInterval(() => void load(), POLL_MS);
    return () => {
      window.clearTimeout(task);
      window.clearInterval(clock);
    };
  }, [load]);

  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!data) {
    return <p className="text-sm text-muted-foreground">{loading ? 'A carregar os eventos…' : 'Sem eventos.'}</p>;
  }

  const year = new Date().getFullYear();
  const withEvents = data.participants.filter((p) => p.events.length > 0);
  const totalExits = data.participants.reduce((n, p) => n + summarizeIntegrity(p.events).exits, 0);

  return (
    <section aria-labelledby="integrity-title" className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="integrity-title" className="text-lg font-semibold">Integridade</h2>
          <p className="text-xs text-muted-foreground">
            Saídas da prova, colagens recusadas e tentativas de abrir o tutor. Não substitui supervisão
            presencial nem um bloqueio do dispositivo: só regista o que o browser vê.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={loading ? 'animate-spin' : undefined} aria-hidden /> Atualizar
        </Button>
      </div>

      {withEvents.length === 0 ? (
        <Card>
          <CardContent className="flex items-center gap-3 p-6 text-sm text-muted-foreground">
            <ShieldCheck className="size-5 text-success" aria-hidden />
            Ainda não há eventos: ninguém saiu da prova nem tentou colar.
          </CardContent>
        </Card>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            <strong className="text-foreground">{totalExits}</strong>
            {totalExits === 1 ? ' saída da prova' : ' saídas da prova'} em {withEvents.length} de {data.participants.length}{' '}
            {data.participants.length === 1 ? 'aluno' : 'alunos'}.
          </p>
          <Card className="overflow-hidden">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-48 font-medium text-muted-foreground">Aluno</TableHead>
                    <TableHead className="w-28 font-medium text-muted-foreground">Saídas</TableHead>
                    <TableHead className="font-medium text-muted-foreground">Eventos</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {withEvents.map((p) => {
                    const summary = summarizeIntegrity(p.events);
                    return (
                      <TableRow key={p.accountId}>
                        <TableCell className="align-top font-medium">{participantName(p)}</TableCell>
                        <TableCell className="align-top">
                          <Badge variant={summary.exits > 0 ? 'warning' : 'secondary'}>
                            {summary.exits > 0 ? `${summary.exits}×` : '0'}
                          </Badge>
                        </TableCell>
                        <TableCell className="align-top">
                          <ul className="grid gap-1 text-sm">
                            {p.events.map((e) => (
                              <li key={e.id} className="flex items-baseline gap-2">
                                <span className="tabular-nums text-xs text-muted-foreground">
                                  {formatWall(e.at, year).slice(-5)}
                                </span>
                                <span className="flex items-center gap-1.5">
                                  {e.kind === 'PASTE_BLOCKED' || e.kind === 'TUTOR_BLOCKED' ? (
                                    <ShieldAlert className="size-3.5 text-warning" aria-hidden />
                                  ) : null}
                                  {summary.byKind.find((b) => b.kind === e.kind)?.label ?? e.kind}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </section>
  );
}
