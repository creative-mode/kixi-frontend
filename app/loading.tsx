import { DashboardSkeleton } from '@/components/dashboard/dashboard-skeleton';

// O painel em esqueleto, mostrado logo no clique (#389). As rotas sem `loading.tsx` próprio também caem aqui.
export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl p-6 md:p-8 lg:p-10">
      <DashboardSkeleton />
    </div>
  );
}
