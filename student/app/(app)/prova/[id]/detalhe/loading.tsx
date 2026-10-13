import { Column, Page } from '@/components/page';
import { Card } from '@/components/ui/card';
import { Skeleton, SkeletonText } from '@/components/ui/skeleton';

/** The detail loading: the header and its facts, then the two mode cards. */
export default function Loading() {
  return (
    <Page>
      <span className="sr-only" role="status">A carregar a prova…</span>
      <Column className="gap-5">
        <Skeleton className="h-8 w-28" />
        <div className="grid gap-2">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-7 w-64 max-w-full" />
          <Skeleton className="h-3.5 w-48 max-w-full" />
        </div>
        <Card className="gap-4 p-5">
          <Skeleton className="h-5 w-40" />
          <div className="grid gap-3 sm:grid-cols-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex items-start gap-3 rounded-lg border px-4 py-3">
                <Skeleton className="size-9 rounded-lg" />
                <div className="grid flex-1 gap-1.5"><Skeleton className="h-3 w-16" /><Skeleton className="h-4 w-24" /></div>
              </div>
            ))}
          </div>
        </Card>
        <Card className="gap-4 p-5">
          <Skeleton className="h-5 w-64" />
          <SkeletonText lines={1} />
          <div className="grid gap-3 sm:grid-cols-2">
            {[0, 1].map((i) => <Skeleton key={i} className="h-36 w-full rounded-xl" />)}
          </div>
        </Card>
        <Card className="gap-3 p-5">
          <Skeleton className="h-5 w-44" />
          <SkeletonText lines={3} />
        </Card>
      </Column>
    </Page>
  );
}
