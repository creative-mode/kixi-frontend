'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TableRowsSkeleton } from '@/components/crud/loading';
import { roomGrades } from '@/app/actions/exam-rooms';
import { RoomCorrection } from './room-correction';
import { formatWall, gradesCsv, PARTICIPANT_LABEL, participantName, summarizeGrades, type Grade } from '@/lib/exam-rooms/model';

const fmt = (n: number | null, digits = 1) =>
  n === null ? '—' : new Intl.NumberFormat('pt-PT', { maximumFractionDigits: digits }).format(n);

/** As notas da sala encerrada: resumo, distribuição, tabela por aluno e CSV. */
export function RoomResults({ roomId, title, totalMaxScore }: { roomId: number; title: string; totalMaxScore: number | null }) {
  const [grades, setGrades] = useState<Grade[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** A sala é de um plano do trimestre: a correção é da IA, não do professor. */
  const [planLinked, setPlanLinked] = useState(false);
  const max = totalMaxScore && totalMaxScore > 0 ? totalMaxScore : 20;

  const load = useCallback(async () => {
    setError(null);
    const res = await roomGrades(roomId);
    if (res.ok) setGrades(res.data);
    else {
      setGrades([]);
      setError(res.error);
    }
  }, [roomId]);

  useEffect(() => {
    const task = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(task);
  }, [load]);

  const summary = useMemo(() => (grades ? summarizeGrades(grades, max) : null), [grades, max]);
  const sorted = useMemo(
    () => (grades ? [...grades].sort((a, b) => (b.finalScore ?? -1) - (a.finalScore ?? -1) || a.accountId - b.accountId) : null),
    [grades],
  );
  const peak = summary ? Math.max(1, ...summary.buckets.map((b) => b.count)) : 1;

  function download() {
    if (!grades) return;
    const blob = new Blob([gradesCsv(sorted ?? grades)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `notas-sala-${roomId}-${title.replace(/[^\p{L}\p{N}]+/gu, '-').toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section aria-labelledby="results-title" className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="results-title" className="text-lg font-semibold">Notas</h2>
        <Button variant="outline" onClick={download} disabled={!grades?.length}>
          <Download size={16} aria-hidden /> Exportar CSV
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Média" value={summary ? `${fmt(summary.average)} / ${fmt(max)}` : '…'} />
        <Stat label="Positivas" value={summary?.passRate != null ? `${fmt(summary.passRate)}%` : '—'} hint={`nota de ${fmt(max / 2)} ou mais`} />
        <Stat label="Entregaram" value={summary ? `${summary.graded} de ${summary.invited}` : '…'} />
        <Stat label="Mín. · Máx." value={summary ? `${fmt(summary.min)} · ${fmt(summary.max)}` : '…'} />
      </div>

      {summary && summary.pendingReview > 0 ? (
        <p role="status" className="rounded-lg border border-warning/40 bg-warning-soft px-4 py-3 text-sm text-warning">
          {summary.pendingReview === 1 ? '1 aluno tem' : `${summary.pendingReview} alunos têm`}{' '}
          {planLinked ? 'respostas abertas a aguardar a correção automática da IA: a nota final ainda pode subir.' : 'respostas abertas por corrigir: a nota final ainda pode subir.'}
        </p>
      ) : null}

      {summary && summary.graded > 0 ? <RoomCorrection roomId={roomId} onChanged={() => void load()} onPlanLinked={setPlanLinked} /> : null}

      {summary && summary.graded > 0 ? (
        <Card>
          <CardHeader><CardTitle className="text-base">Distribuição das notas</CardTitle></CardHeader>
          <CardContent>
            <ol className="flex h-40 items-end gap-1.5" aria-label="Número de alunos por intervalo de nota">
              {summary.buckets.map((b) => (
                <li key={b.label} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                  <span className="text-xs tabular-nums text-muted-foreground">{b.count || ''}</span>
                  <span
                    className="w-full rounded-t-sm bg-primary/80"
                    style={{ height: `${(b.count / peak) * 100}%`, minHeight: b.count ? 4 : 0 }}
                    aria-label={`${b.label}: ${b.count} ${b.count === 1 ? 'aluno' : 'alunos'}`}
                  />
                  <span className="text-[10px] tabular-nums text-muted-foreground">{b.label}</span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      ) : null}

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="font-medium text-muted-foreground">Aluno</TableHead>
                <TableHead className="w-32 font-medium text-muted-foreground">Estado</TableHead>
                <TableHead className="w-24 text-right font-medium text-muted-foreground">Nota</TableHead>
                <TableHead className="hidden w-28 text-right font-medium text-muted-foreground sm:table-cell">Certas</TableHead>
                <TableHead className="hidden w-32 font-medium text-muted-foreground md:table-cell">Entregue</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted === null ? (
                <TableRowsSkeleton cols={5} rows={5} />
              ) : error ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-12 text-center">
                    <p className="mb-3 text-sm text-destructive">{error}</p>
                    <Button size="sm" variant="outline" onClick={load}>Tentar de novo</Button>
                  </TableCell>
                </TableRow>
              ) : sorted.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="py-12 text-center text-sm text-muted-foreground">Ninguém foi convidado para esta sala.</TableCell></TableRow>
              ) : (
                sorted.map((g) => (
                  <TableRow key={g.accountId}>
                    <TableCell className="font-medium">{participantName(g)}</TableCell>
                    <TableCell>
                      {g.status ? <Badge variant={g.status === 'FINISHED' ? 'success' : 'secondary'}>{PARTICIPANT_LABEL[g.status] ?? g.status}</Badge> : <Badge variant="outline">Não entrou</Badge>}
                      {g.pendingReviewCount ? <Badge variant="warning" className="ml-1">Por corrigir</Badge> : null}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">{fmt(g.finalScore)}</TableCell>
                    <TableCell className="hidden text-right tabular-nums text-muted-foreground sm:table-cell">
                      {g.correctAnswers != null && g.totalQuestions != null ? `${g.correctAnswers}/${g.totalQuestions}` : '—'}
                    </TableCell>
                    <TableCell className="hidden tabular-nums text-muted-foreground md:table-cell">{formatWall(g.finishedAt)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </section>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}
