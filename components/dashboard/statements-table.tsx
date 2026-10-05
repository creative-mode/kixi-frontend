'use client';

import { useState } from 'react';
import { ChevronRight, KeyRound } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatDuration, formatInt, formatPercent } from '@/lib/format';
import type { StatementStats } from '@/types/analytics';
import { QuestionDialog } from './question-dialog';
import { ScoreCell } from './score-cell';

export function StatementsTable({ statements }: { statements: StatementStats[] }) {
  const [selected, setSelected] = useState<StatementStats | null>(null);

  return (
    <>
      <Table>
        <caption className="sr-only">
          Provas e desempenho. Selecione uma prova para ver o desempenho por questão.
        </caption>
        <TableHeader>
          <TableRow>
            <TableHead>Prova</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="text-right">Simulações</TableHead>
            <TableHead className="text-right">Aprovação</TableHead>
            <TableHead className="text-right">Nota média</TableHead>
            <TableHead className="text-right">Tempo médio</TableHead>
            <TableHead><span className="sr-only">Detalhe</span></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {statements.map((s) => (
            <TableRow key={s.id}>
              <th scope="row" className="p-2 text-left align-middle">
                <button
                  type="button"
                  onClick={() => setSelected(s)}
                  className="rounded-sm text-left font-semibold text-foreground outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/40"
                >
                  {s.title ?? `Prova #${s.id}`}
                </button>
                <div className="text-xs font-normal text-muted-foreground">
                  {[s.subject, s.classCode, s.examType].filter(Boolean).join(' · ') || '—'}
                </div>
              </th>
              <TableCell>
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant={s.published ? 'success' : 'secondary'}>
                    {s.published ? 'Publicada' : 'Rascunho'}
                  </Badge>
                  {s.needsReview && <Badge variant="warning">Por rever</Badge>}
                  {!s.answerKeyComplete && (
                    <Badge variant="destructive">
                      <KeyRound aria-hidden />
                      Sem gabarito
                    </Badge>
                  )}
                </div>
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatInt(s.finishedSimulations)}
                <div className="text-xs text-muted-foreground">{formatInt(s.uniqueStudents)} estudantes</div>
              </TableCell>
              <TableCell className="text-right tabular-nums">{formatPercent(s.passRatePercent)}</TableCell>
              <TableCell><ScoreCell percent={s.averageScorePercent} /></TableCell>
              <TableCell className="text-right tabular-nums">{formatDuration(s.averageTimeSeconds)}</TableCell>
              <TableCell className="text-right">
                <button
                  type="button"
                  onClick={() => setSelected(s)}
                  aria-label={`Ver questões de ${s.title ?? `prova ${s.id}`}`}
                  className="rounded-md p-1 text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40"
                >
                  <ChevronRight className="h-4 w-4" aria-hidden />
                </button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <QuestionDialog key={selected?.id ?? 'none'} statement={selected} onClose={() => setSelected(null)} />
    </>
  );
}
