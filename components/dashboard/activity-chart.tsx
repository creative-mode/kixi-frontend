'use client';

import { Bar, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from 'recharts';
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { formatDay } from '@/lib/format';
import type { ActivityPoint } from '@/types/analytics';

// Design-system tokens, so the chart follows the light "Ecrã" and dark "Noite" themes.
const config = {
  finished: { label: 'Simulações concluídas', color: 'var(--chart-1)' },
  averageScorePercent: { label: 'Nota média (%)', color: 'var(--chart-2)' },
} satisfies ChartConfig;

/** Finished simulations per day (bars) and the average score of that day (line). */
export function ActivityChart({ points }: { points: ActivityPoint[] }) {
  const summary = `${points.reduce((n, p) => n + p.finished, 0)} simulações concluídas em ${points.length} dias`;

  return (
    <ChartContainer config={config} className="aspect-auto h-72 w-full" aria-label={summary} role="img">
      <ComposedChart data={points} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
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
        <ChartTooltip
          content={
            <ChartTooltipContent
              labelFormatter={(_, payload) => {
                const date = payload?.[0]?.payload?.date as string | undefined;
                return date ? formatDay(date) : '';
              }}
            />
          }
        />
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
  );
}
