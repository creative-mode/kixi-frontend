'use client';

import { useCallback, useEffect, useState } from 'react';
import { coordinationGrades, coordinationRooms } from '@/app/actions/coordination';
import { ACTION_TIMEOUT_MS, withDeadline } from '@/lib/timeout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SectionState } from '@/components/dashboard/section-state';
import { gradeStatusLabel, gradeText, roomProgress, roomsByUrgency, ROOM_STATUS_LABEL } from '@/lib/coordination';
import { formatDate } from '@/lib/term-plans';
import type { Section } from '@/types/analytics';
import type { CoordinationGrade, CoordinationRoom } from '@/types/coordination';

/** As salas de prova da instituição, só para acompanhar (o coordenador não fecha salas nem corrige: é do professor dono da sala). */
export function CoordinationView() {
  const [rooms, setRooms] = useState<Section<CoordinationRoom[]> | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const [grades, setGrades] = useState<Section<CoordinationGrade[]> | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await withDeadline(coordinationRooms(), ACTION_TIMEOUT_MS);
      setRooms(r.ok ? { ok: true, data: r.data } : { ok: false, error: r.error });
    } catch {
      setRooms({ ok: false, error: 'Não foi possível contactar o servidor. Tente novamente.' });
    }
  }, []);

  useEffect(() => {
    const task = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(task);
  }, [load]);

  const show = useCallback(async (id: number) => {
    setOpen(id);
    setGrades(null);
    try {
      const r = await withDeadline(coordinationGrades(id), ACTION_TIMEOUT_MS);
      setGrades(r.ok ? { ok: true, data: r.data } : { ok: false, error: r.error });
    } catch {
      setGrades({ ok: false, error: 'Não foi possível contactar o servidor. Tente novamente.' });
    }
  }, []);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 md:p-7">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Salas da instituição</h1>
        <p className="text-sm text-muted-foreground">Acompanhe as provas em curso e as notas por aluno. Só leitura: quem fecha e corrige é o professor.</p>
      </header>
      <SectionState section={rooms} onRetry={() => void load()} isEmpty={(d) => d.length === 0} empty={<p className="text-sm text-muted-foreground">Ainda não há salas na sua instituição.</p>}>
        {(data) => (
          <ul className="flex flex-col gap-3">
            {roomsByUrgency(data).map((room) => (
              <li key={room.id}>
                <Card>
                  <CardHeader>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <CardTitle>{room.statementTitle}</CardTitle>
                      <Badge variant={room.pendingAnswers > 0 ? 'destructive' : room.status === 'CLOSED' ? 'outline' : 'secondary'}>{ROOM_STATUS_LABEL[room.status]}</Badge>
                    </div>
                    <CardDescription>
                      {room.className} · {room.teacherName || `Professor ${room.teacherAccountId}`} · {formatDate(room.startsAt)} a {formatDate(room.endsAt)}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-3">
                    <p className="text-sm">{roomProgress(room)}</p>
                    <div>
                      <Button size="sm" variant="outline" aria-expanded={open === room.id} onClick={() => (open === room.id ? setOpen(null) : void show(room.id))}>
                        {open === room.id ? 'Esconder as notas' : 'Ver as notas'}
                      </Button>
                    </div>
                    {open === room.id && (
                      <SectionState section={grades} onRetry={() => void show(room.id)} isEmpty={(d) => d.length === 0} empty={<p className="text-sm text-muted-foreground">Ninguém entrou nesta sala.</p>}>
                        {(rows) => (
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead><tr className="text-left text-muted-foreground"><th className="py-1 pr-4">Aluno</th><th className="py-1 pr-4">Estado</th><th className="py-1">Nota</th></tr></thead>
                              <tbody>
                                {rows.map((g) => (
                                  <tr key={g.accountId} className="border-t">
                                    <td className="py-1.5 pr-4">{g.name || `Conta ${g.accountId}`}</td>
                                    <td className="py-1.5 pr-4">{gradeStatusLabel(g)}</td>
                                    <td className="py-1.5 tabular-nums">{gradeText(g)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </SectionState>
                    )}
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </SectionState>
    </div>
  );
}
