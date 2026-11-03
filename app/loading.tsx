import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { DashboardSkeleton } from '@/components/dashboard/dashboard-skeleton';

/** Esqueleto do gestor enquanto a rota carrega: cabeçalho e o próprio
 *  `DashboardSkeleton`, para o primeiro ecrã já ter a forma do conteúdo. */
export default function Loading() {
  return (
    <main aria-label="A carregar" className="mx-auto max-w-7xl space-y-8 p-6 md:p-8 lg:p-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="grid gap-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-8 w-40" />
      </div>
      <Card>
        <CardContent>
          <DashboardSkeleton />
        </CardContent>
      </Card>
    </main>
  );
}
