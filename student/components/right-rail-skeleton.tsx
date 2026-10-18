import { Skeleton } from '@/components/ui/skeleton';

/** O lugar da coluna da direita enquanto ela chega (#393): a página já está pintada, a coluna preenche depois. */
export function RightRailSkeleton() {
  return (
    <div className="grid gap-4" aria-hidden="true">
      {[3, 2, 3].map((rows, i) => (
        <div key={i} className="grid gap-3 rounded-xl border bg-secondary/60 p-4">
          <Skeleton className="h-5 w-40" />
          {Array.from({ length: rows }, (_, j) => <Skeleton key={j} className="h-9 w-full" />)}
        </div>
      ))}
    </div>
  );
}
