'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Gift } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TableRowsSkeleton } from '@/components/crud/loading';
import { listDonations } from '@/app/actions/donations';
import {
  DONATION_STATUSES,
  STATUS_LABEL,
  pageCount,
  type DonationPage,
  type DonationStatus,
} from '@/lib/donations/model';

export const STATUS_VARIANT: Record<DonationStatus, 'warning' | 'success' | 'outline' | 'info'> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'outline',
  converted: 'info',
};

export function DonationStatusBadge({ status }: { status: DonationStatus }) {
  return <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABEL[status]}</Badge>;
}

const when = (iso: string) => iso.slice(0, 16).replace('T', ' ');

export function DonationsList() {
  const [status, setStatus] = useState<DonationStatus | null>('pending');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<DonationPage | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const res = await listDonations(status, page);
    if (res.ok) setData(res.data);
    else {
      setData(null);
      setError(res.error);
    }
  }, [status, page]);

  useEffect(() => {
    const task = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(task);
  }, [load]);

  const pick = (next: DonationStatus | null) => {
    setData(null);
    setPage(1);
    setStatus(next);
  };
  const pages = data ? pageCount(data.total, data.limit) : 1;
  const total = data ? DONATION_STATUSES.reduce((sum, s) => sum + (data.counts[s] ?? 0), 0) : 0;

  return (
    <div className="mx-auto max-w-6xl p-4 md:p-8">
      <div className="mb-6 flex items-center gap-3">
        <div className="rounded-md bg-accent p-2 text-primary"><Gift size={20} aria-hidden /></div>
        <div>
          <h1 className="text-2xl font-bold text-foreground md:text-3xl">Doações</h1>
          <p className="text-sm text-muted-foreground">Enunciados enviados pela página pública. Reveja, aprove e abra no construtor.</p>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Filtrar por estado">
        <Button size="sm" variant={status === null ? 'default' : 'outline'} aria-pressed={status === null} onClick={() => pick(null)}>
          Todas{data ? ` (${total})` : ''}
        </Button>
        {DONATION_STATUSES.map((s) => (
          <Button key={s} size="sm" variant={status === s ? 'default' : 'outline'} aria-pressed={status === s} onClick={() => pick(s)}>
            {STATUS_LABEL[s]}{data ? ` (${data.counts[s] ?? 0})` : ''}
          </Button>
        ))}
      </div>

      {error ? (
        <Card><CardContent className="py-12 text-center">
          <p className="mb-3 text-sm text-destructive" role="alert">{error}</p>
          <Button size="sm" variant="outline" onClick={load}>Tentar de novo</Button>
        </CardContent></Card>
      ) : data === null ? (
        <Card className="overflow-hidden"><CardContent className="p-0"><Table><TableBody><TableRowsSkeleton cols={5} rows={4} /></TableBody></Table></CardContent></Card>
      ) : data.items.length === 0 ? (
        <Card><CardContent className="py-16 text-center text-sm text-muted-foreground">
          {status ? `Não há doações «${STATUS_LABEL[status].toLowerCase()}».` : 'Ainda não chegou nenhuma doação.'}
        </CardContent></Card>
      ) : (
        <>
          <ul className="grid gap-3 md:hidden">
            {data.items.map((d) => (
              <li key={d.id}>
                <Link href={`/donations/${d.id}`} className="block rounded-xl border bg-card p-4 shadow-xs transition-colors hover:border-primary">
                  <div className="flex items-start justify-between gap-3">
                    <span className="font-semibold">{d.subjectName} · {d.examType}</span>
                    <DonationStatusBadge status={d.status} />
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{d.institutionName}</p>
                  <p className="mt-1 text-sm tabular-nums text-muted-foreground">{d.reference} · {d.fileCount} ficheiro(s) · {when(d.createdAt)}</p>
                </Link>
              </li>
            ))}
          </ul>
          <Card className="hidden overflow-hidden md:block">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="font-medium text-muted-foreground">Prova</TableHead>
                    <TableHead className="font-medium text-muted-foreground">Instituição</TableHead>
                    <TableHead className="w-28 font-medium text-muted-foreground">Ficheiros</TableHead>
                    <TableHead className="w-40 font-medium text-muted-foreground">Recebida</TableHead>
                    <TableHead className="w-44 font-medium text-muted-foreground">Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((d) => (
                    <TableRow key={d.id} className="border-border hover:bg-accent/50">
                      <TableCell>
                        <Link href={`/donations/${d.id}`} className="font-medium hover:underline">{d.subjectName} · {d.examType}</Link>
                        <div className="text-xs tabular-nums text-muted-foreground">{d.reference}{d.classGrade ? ` · ${d.classGrade}` : ''}{d.schoolYear ? ` · ${d.schoolYear}` : ''}</div>
                      </TableCell>
                      <TableCell>{d.institutionName}</TableCell>
                      <TableCell className="tabular-nums">{d.fileCount}</TableCell>
                      <TableCell className="tabular-nums text-muted-foreground">{when(d.createdAt)}</TableCell>
                      <TableCell><DonationStatusBadge status={d.status} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          {pages > 1 && (
            <nav className="mt-4 flex items-center justify-between" aria-label="Paginação">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => { setData(null); setPage(page - 1); }}>
                <ChevronLeft size={14} /> Anterior
              </Button>
              <span className="text-sm text-muted-foreground">Página {page} de {pages}</span>
              <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => { setData(null); setPage(page + 1); }}>
                Seguinte <ChevronRight size={14} />
              </Button>
            </nav>
          )}
        </>
      )}
    </div>
  );
}
