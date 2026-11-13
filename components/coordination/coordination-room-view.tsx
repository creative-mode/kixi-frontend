'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { coordinationGrades, coordinationRoom } from '@/app/actions/coordination';
import { ACTION_TIMEOUT_MS, withDeadline } from '@/lib/timeout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { SectionState } from '@/components/dashboard/section-state';
import { RoomStatusBadge } from '@/components/exam-rooms/room-head';
import { gradeStatusLabel, gradeText, roomProgress } from '@/lib/coordination';
import { formatDate } from '@/lib/term-plans';
import type { Section } from '@/types/analytics';
import type { CoordinationGrade, CoordinationRoom } from '@/types/coordination';

/** O detalhe de uma sala da instituição, em leitura: o estado, o progresso e as notas por aluno (#759). */
export function CoordinationRoomView({ id }: { id: number }) {
  const [room, setRoom] = useState<CoordinationRoom | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [grades, setGrades] = useState<Section<CoordinationGrade[]> | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setRoom(null);
    setGrades(null);
    try {
      const found = await withDeadline(coordinationRoom(id), ACTION_TIMEOUT_MS);
      if (!found.ok) {
        setError(found.error);
        return;
      }
      setRoom(found.data);
      const rows = await withDeadline(coordinationGrades(id), ACTION_TIMEOUT_MS);
      setGrades(rows.ok ? { ok: true, data: rows.data } : { ok: false, error: rows.error });
    } catch {
      setError('Não foi possível contactar o servidor. Tente novamente.');
    }
  }, [id]);

  useEffect(() => {
    const task = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(task);
  }, [load]);

  const back = (
    <Link href="/coordenacao" className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground">
      <ArrowLeft size={14} /> Salas da instituição
    </Link>
  );

  if (error) {
    return (
      <div className="mx-auto max-w-5xl p-4 md:p-8">
        {back}
        <Card><CardContent className="py-12 text-center">
          <p className="mb-3 text-sm text-destructive" role="alert">{error}</p>
          <Button size="sm" variant="outline" onClick={() => void load()}>Tentar de novo</Button>
        </CardContent></Card>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="mx-auto max-w-5xl p-4 md:p-8">
        {back}
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 md:p-7">
      {back}
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{room.statementTitle}</h1>
          <p className="text-sm text-muted-foreground">
            {room.className} · {room.teacherName ?? '—'} · {formatDate(room.startsAt)} a {formatDate(room.endsAt)}
          </p>
        </div>
        <RoomStatusBadge status={room.status} />
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Progresso</CardTitle>
          <CardDescription>{room.pendingAnswers > 0 ? 'Há respostas à espera do professor.' : 'Acompanhamento da entrega e da correção.'}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm">{roomProgress(room)}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notas</CardTitle>
          <CardDescription>Só leitura: quem fecha e corrige é o professor dono da sala.</CardDescription>
        </CardHeader>
        <CardContent>
          <SectionState
            section={grades}
            onRetry={() => void load()}
            isEmpty={(d) => d.length === 0}
            empty={<p className="text-sm text-muted-foreground">Ninguém entrou nesta sala.</p>}
          >
            {(rows) => (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-muted-foreground"><th className="py-1 pr-4">Aluno</th><th className="py-1 pr-4">Estado</th><th className="py-1">Nota</th></tr></thead>
                  <tbody>
                    {rows.map((g) => (
                      <tr key={g.accountId} className="border-t">
                        <td className="py-1.5 pr-4">{g.name ?? '—'}</td>
                        <td className="py-1.5 pr-4">{gradeStatusLabel(g)}</td>
                        <td className="py-1.5 tabular-nums">{gradeText(g)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionState>
        </CardContent>
      </Card>
    </div>
  );
}
