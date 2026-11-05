'use client';

import { useCallback, useEffect, useId, useRef, useState, type ComponentProps } from 'react';
import { Bar, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from 'recharts';
import { Button } from '@/components/ui/button';
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { activitySummary, describePoint, type ActivityUnit } from '@/lib/activity-chart';
import { formatDay, formatInt, formatPercent } from '@/lib/format';
import type { ActivityPoint } from '@/types/analytics';

// Design-system tokens, so the chart follows the app theme.
const config = {
  finished: { label: 'Simulações concluídas', color: 'var(--chart-1)' },
  averageScorePercent: { label: 'Nota média (%)', color: 'var(--chart-2)' },
} satisfies ChartConfig;

/** Um ponto semanal começa à segunda-feira: o rótulo diz «Semana de», não só a data. */
function periodLabel(date: string, unit: ActivityUnit): string {
  return unit === 'semana' ? `Semana de ${formatDay(date)}` : formatDay(date);
}

/**
 * Anuncia o ponto ativo. O Recharts move o tooltip com as setas mas não o diz a ninguém,
 * por isso o texto vai para uma região `aria-live` que existe sempre (uma que só aparece
 * com o tooltip não é anunciada). Escreve-se no DOM, sem estado, para não renderizar de novo.
 */
function TooltipAnnouncer({
  announce,
  unit,
  ...props
}: ComponentProps<typeof ChartTooltipContent> & { announce: (text: string) => void; unit: ActivityUnit }) {
  const point = props.active ? (props.payload?.[0]?.payload as ActivityPoint | undefined) : undefined;
  const text = point
    ? describePoint(
        periodLabel(point.date, unit),
        point.finished,
        point.averageScorePercent == null ? null : formatPercent(point.averageScorePercent),
      )
    : '';
  useEffect(() => announce(text), [announce, text]);

  return (
    <ChartTooltipContent
      {...props}
      labelFormatter={(_, payload) => {
        const date = payload?.[0]?.payload?.date as string | undefined;
        return date ? periodLabel(date, unit) : '';
      }}
    />
  );
}

/**
 * Simulações concluídas por período (barras) e a nota média desse período (linha).
 * `unit` diz se cada ponto é um dia (dashboard do gestor) ou uma semana (desempenho da turma).
 * Há sempre uma alternativa em tabela, com os mesmos valores.
 */
export function ActivityChart({ points, unit = 'dia' }: { points: ActivityPoint[]; unit?: ActivityUnit }) {
  const [asTable, setAsTable] = useState(false);
  const live = useRef<HTMLDivElement>(null);
  const announce = useCallback((text: string) => {
    if (live.current && live.current.textContent !== text) live.current.textContent = text;
  }, []);
  const id = useId();
  const summary = activitySummary(points, unit);

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-pressed={asTable}
          aria-controls={`${id}-vista`}
          onClick={() => setAsTable((v) => !v)}
        >
          {asTable ? 'Ver como gráfico' : 'Ver como tabela'}
        </Button>
      </div>

      <div id={`${id}-vista`}>
        {asTable ? (
          <Table>
            <caption className="sr-only">{summary}</caption>
            <TableHeader>
              <TableRow>
                <TableHead>{unit === 'semana' ? 'Semana' : 'Dia'}</TableHead>
                <TableHead className="text-right">Concluídas</TableHead>
                <TableHead className="text-right">Nota média</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {points.map((p) => (
                <TableRow key={p.date}>
                  <th scope="row" className="p-2 text-left align-middle font-medium">{periodLabel(p.date, unit)}</th>
                  <TableCell className="text-right tabular-nums">{formatInt(p.finished)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatPercent(p.averageScorePercent)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <>
            <ChartContainer config={config} className="aspect-auto h-72 w-full" role="group" aria-label={summary} aria-describedby={`${id}-ajuda`}>
              <ComposedChart accessibilityLayer data={points} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="date" tickFormatter={formatDay} tickLine={false} axisLine={false} minTickGap={24} />
                <YAxis yAxisId="count" allowDecimals={false} tickLine={false} axisLine={false} />
                <YAxis
                  yAxisId="score"
                  orientation="right"
                  domain={[0, 100]}
                  tickFormatter={(v) => `${v}%`}
                  tickLine={false}
                  axisLine={false}
                />
                <ChartTooltip content={<TooltipAnnouncer announce={announce} unit={unit} />} />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar
                  yAxisId="count"
                  dataKey="finished"
                  isAnimationActive={false}
                  fill="var(--color-finished)"
                  radius={[2, 2, 0, 0]}
                />
                <Line
                  yAxisId="score"
                  dataKey="averageScorePercent"
                  isAnimationActive={false}
                  type="monotone"
                  stroke="var(--color-averageScorePercent)"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  connectNulls
                />
              </ComposedChart>
            </ChartContainer>
            <p id={`${id}-ajuda`} className="mt-2 text-xs text-muted-foreground">
              Barras: simulações concluídas (eixo da esquerda). Linha: nota média em % (eixo da direita). Com o gráfico
              focado, use as setas para percorrer os pontos.
            </p>
          </>
        )}
      </div>
      <div ref={live} className="sr-only" role="status" aria-live="polite" aria-atomic="true" />
    </div>
  );
}
