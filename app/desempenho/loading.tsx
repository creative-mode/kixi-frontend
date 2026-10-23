import { ChartSkeleton, SectionSkeleton } from '@/components/dashboard/dashboard-skeleton';

// Mostrado logo no clique, enquanto o desempenho chega (#389).
export default function Loading() {
  return (
    <div role="status" aria-label="A carregar o desempenho" className="mx-auto max-w-7xl space-y-8 p-6 md:p-8 lg:p-10">
      <SectionSkeleton><ChartSkeleton /></SectionSkeleton>
      <SectionSkeleton />
    </div>
  );
}
