'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TableRowsSkeleton } from '@/components/crud/loading';
import { listInstitutionRooms, type InstitutionRoom } from '@/app/actions/exam-rooms';
import { roomProgress } from '@/lib/coordination';
import { formatWall } from '@/lib/exam-rooms/model';
import { RoomHead, RoomStatusBadge } from './room-head';

const COLS = 8;

/**
 * A lista de salas do ADMIN (#759): todas as instituições, com o professor, a
 * escola e o progresso. O coordenador continua a usar `/coordenacao`; o professor
 * vê só as suas em `RoomsList`.
 */
export function InstitutionRoomsList() {
  const [rows, setRows] = useState<InstitutionRoom[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const res = await listInstitutionRooms();
    if (res.ok) setRows(res.data);
    else {
      setRows([]);
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
        subtitle="Todas as salas das instituições, com o professor, a escola e o progresso."
        actions={
          <Button asChild>
            <Link href="/exam-rooms/new"><Plus size={16} /> Nova sala</Link>
          </Button>
        }
      />
      {rows === null ? (
        <Card className="overflow-hidden"><CardContent className="p-0"><Table><TableBody><TableRowsSkeleton cols={COLS} rows={4} /></TableBody></Table></CardContent></Card>
      ) : error ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="mb-3 text-sm text-destructive" role="alert">{error}</p>
            <Button size="sm" variant="outline" onClick={load}>Tentar de novo</Button>
          </CardContent>
        </Card>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <p className="mb-3 text-sm">Ainda não há salas de prova.</p>
            <Button asChild size="sm">
              <Link href="/exam-rooms/new"><Plus size={14} /> Criar a primeira</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <ul className="grid gap-3 md:hidden">
            {rows.map(({ room, institutionName }) => (
              <li key={room.id}>
                <Link href={`/exam-rooms/${room.id}`} className="block rounded-xl border bg-card p-4 shadow-xs transition-colors hover:border-primary">
                  <div className="flex items-start justify-between gap-3">
                    <span className="font-semibold">{room.statementTitle}</span>
                    <RoomStatusBadge room={room} />
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {room.className} · {institutionName ?? '—'} · {room.teacherName ?? '—'}
                  </p>
                  <p className="mt-1 text-sm tabular-nums text-muted-foreground">
                    {formatWall(room.startsAt, year)} → {formatWall(room.endsAt, year)}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">{roomProgress(room)}</p>
                  <span className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-primary">Ver notas <ArrowRight size={14} aria-hidden /></span>
                </Link>
              </li>
            ))}
          </ul>
          <Card className="hidden overflow-hidden md:block">
            <CardContent className="overflow-x-auto p-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="font-medium text-muted-foreground">Enunciado</TableHead>
                    <TableHead className="w-20 font-medium text-muted-foreground">Turma</TableHead>
                    <TableHead className="font-medium text-muted-foreground">Instituição</TableHead>
                    <TableHead className="font-medium text-muted-foreground">Professor</TableHead>
                    <TableHead className="font-medium text-muted-foreground">Janela</TableHead>
                    <TableHead className="font-medium text-muted-foreground">Progresso</TableHead>
                    <TableHead className="w-28 font-medium text-muted-foreground">Estado</TableHead>
                    <TableHead className="w-28 text-right font-medium text-muted-foreground"><span className="sr-only">Notas</span></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map(({ room, institutionName }) => (
                    <TableRow key={room.id} className="border-border hover:bg-accent/50">
                      <TableCell className="font-medium">{room.statementTitle}</TableCell>
                      <TableCell>{room.className}</TableCell>
                      <TableCell>{institutionName ?? '—'}</TableCell>
                      <TableCell>{room.teacherName ?? '—'}</TableCell>
                      <TableCell className="tabular-nums text-muted-foreground">
                        {formatWall(room.startsAt, year)} → {formatWall(room.endsAt, year)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{roomProgress(room)}</TableCell>
                      <TableCell><RoomStatusBadge room={room} /></TableCell>
                      <TableCell className="text-right">
                        <Button asChild variant="ghost" size="sm">
                          <Link href={`/exam-rooms/${room.id}`}>
                            Ver notas<span className="sr-only"> de {room.statementTitle}</span> <ArrowRight size={14} aria-hidden />
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
