'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TableRowsSkeleton } from '@/components/crud/loading';
import { listRooms, type RoomListing } from '@/app/actions/exam-rooms';
import { formatWall } from '@/lib/exam-rooms/model';
import { RoomHead, RoomStatusBadge } from './room-head';

const COLS = 5;

const titleOf = (d: RoomListing, statementId: number) => d.statements[statementId]?.title ?? `Enunciado ${statementId}`;
const classOf = (d: RoomListing, classId: number | null) =>
  classId == null ? '—' : (d.classes[classId]?.code ?? `Turma ${classId}`);

export function RoomsList() {
  const [data, setData] = useState<RoomListing | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const res = await listRooms();
    if (res.ok) setData(res.data);
    else {
      setData({ rooms: [], statements: {}, classes: {} });
      setError(res.error);
    }
  }, []);

  useEffect(() => {
    const task = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(task);
  }, [load]);

  const year = new Date().getFullYear();

  return (
    <div className="mx-auto max-w-6xl p-4 md:p-8">
      <RoomHead
        title="Salas de Prova"
        subtitle="Provas controladas: a mesma prova, o mesmo tempo, para toda a turma."
        actions={
          <Button asChild>
            <Link href="/exam-rooms/new"><Plus size={16} /> Nova sala</Link>
          </Button>
        }
      />
      {data === null ? (
        <Card className="overflow-hidden"><CardContent className="p-0"><Table><TableBody><TableRowsSkeleton cols={COLS} rows={4} /></TableBody></Table></CardContent></Card>
      ) : error ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="mb-3 text-sm text-destructive">{error}</p>
            <Button size="sm" variant="outline" onClick={load}>Tentar de novo</Button>
          </CardContent>
        </Card>
      ) : data.rooms.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <p className="mb-3 text-sm">Ainda não criou nenhuma sala.</p>
            <Button asChild size="sm">
              <Link href="/exam-rooms/new"><Plus size={14} /> Criar a primeira</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Telemóvel: um cartão por sala, em vez de uma tabela que não cabe. */}
          <ul className="grid gap-3 md:hidden">
            {data.rooms.map((room) => (
              <li key={room.id}>
                <Link href={`/exam-rooms/${room.id}`} className="block rounded-xl border bg-card p-4 shadow-xs transition-colors hover:border-primary">
                  <div className="flex items-start justify-between gap-3">
                    <span className="font-semibold">{titleOf(data, room.statementId)}</span>
                    <RoomStatusBadge status={room.status} />
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {classOf(data, room.classId)} · {room.durationMinutes} min
                  </p>
                  <p className="mt-1 text-sm tabular-nums text-muted-foreground">
                    {formatWall(room.startsAt, year)} → {formatWall(room.endsAt, year)}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
          <Card className="hidden overflow-hidden md:block">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="font-medium text-muted-foreground">Enunciado</TableHead>
                    <TableHead className="w-24 font-medium text-muted-foreground">Turma</TableHead>
                    <TableHead className="font-medium text-muted-foreground">Janela</TableHead>
                    <TableHead className="w-32 font-medium text-muted-foreground">Estado</TableHead>
                    <TableHead className="w-24 text-right font-medium text-muted-foreground"><span className="sr-only">Abrir</span></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.rooms.map((room) => (
                    <TableRow key={room.id} className="border-border hover:bg-accent/50">
                      <TableCell className="font-medium">{titleOf(data, room.statementId)}</TableCell>
                      <TableCell title={room.classId != null ? data.classes[room.classId]?.label : undefined}>{classOf(data, room.classId)}</TableCell>
                      <TableCell className="tabular-nums text-muted-foreground">
                        {formatWall(room.startsAt, year)} → {formatWall(room.endsAt, year)} · {room.durationMinutes} min
                      </TableCell>
                      <TableCell><RoomStatusBadge status={room.status} /></TableCell>
                      <TableCell className="text-right">
                        <Button asChild variant="ghost" size="sm">
                          <Link href={`/exam-rooms/${room.id}`}>
                            {room.status === 'CLOSED' ? 'Notas' : 'Abrir'} <ArrowRight size={14} aria-hidden />
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
