'use client';

import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatDuration, formatInt, formatPercent } from '@/lib/format';
import type { InstitutionStats } from '@/types/analytics';
import { ScoreCell } from './score-cell';

const config = {
  averageScorePercent: { label: 'Nota média (%)', color: 'var(--chart-1)' },
} satisfies ChartConfig;

/** Institutions side by side: average score as bars, volumes in a table below. */
export function InstitutionPanel({ institutions }: { institutions: InstitutionStats[] }) {
  const withData = institutions.filter((i) => i.averageScorePercent != null);

  return (
    <div className="space-y-6">
      {withData.length > 0 ? (
        <ChartContainer
          config={config}
          className="aspect-auto w-full"
          style={{ height: Math.max(120, withData.length * 48 + 32) }}
          role="img"
          aria-label="Nota média por instituição"
        >
          <BarChart data={withData} layout="vertical" margin={{ top: 0, right: 48, left: 8, bottom: 0 }}>
            <CartesianGrid horizontal={false} />
            <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} tickLine={false} axisLine={false} />
            <YAxis dataKey="code" type="category" width={64} tickLine={false} axisLine={false} />
            <ChartTooltip content={<ChartTooltipContent labelFormatter={(_, p) => (p?.[0]?.payload as { name?: string } | undefined)?.name ?? ''} />} />
            <Bar dataKey="averageScorePercent" isAnimationActive={false} fill="var(--color-averageScorePercent)" radius={2} barSize={20}>
              <LabelList
                dataKey="averageScorePercent"
                position="right"
                formatter={(v: number) => formatPercent(v)}
                className="fill-foreground"
              />
            </Bar>
          </BarChart>
        </ChartContainer>
      ) : (
        <p className="rounded-md border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
          Ainda nenhuma instituição tem simulações concluídas para comparar.
        </p>
      )}

      <Table>
        <caption className="sr-only">Instituições</caption>
        <TableHeader>
          <TableRow>
            <TableHead>Instituição</TableHead>
            <TableHead className="text-right">Cursos</TableHead>
            <TableHead className="text-right">Turmas</TableHead>
            <TableHead className="text-right">Estudantes</TableHead>
            <TableHead className="text-right">Simulações</TableHead>
            <TableHead className="text-right">Nota média</TableHead>
            <TableHead className="text-right">Tempo médio</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {institutions.map((i) => (
            <TableRow key={i.id}>
              <th scope="row" className="p-2 text-left align-middle font-semibold">
                {i.name} <span className="font-mono text-xs font-normal text-muted-foreground">{i.code}</span>
              </th>
              <TableCell className="text-right tabular-nums">{formatInt(i.courses)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatInt(i.classes)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatInt(i.students)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatInt(i.finishedSimulations)}</TableCell>
              <TableCell><ScoreCell percent={i.averageScorePercent} /></TableCell>
              <TableCell className="text-right tabular-nums">{formatDuration(i.averageTimeSeconds)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
