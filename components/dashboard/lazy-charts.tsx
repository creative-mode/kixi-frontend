'use client';

import dynamic from 'next/dynamic';
import { ChartSkeleton } from './dashboard-skeleton';

// O recharts só entra quando há um gráfico para desenhar, num chunk à parte (#389): o resto do painel e do
// desempenho não espera por ele, e as páginas que não têm gráficos não o descarregam.
export const ActivityChart = dynamic(() => import('./activity-chart').then((m) => m.ActivityChart), {
  loading: () => <ChartSkeleton />,
});

export const InstitutionPanel = dynamic(() => import('./institution-panel').then((m) => m.InstitutionPanel), {
  loading: () => <ChartSkeleton className="h-40" />,
});
