import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

/** Cartão de indicador: título + ícone, valor e legenda (mesma altura do KpiCard). */
export function KpiSkeleton() {
  return (
    <Card className="gap-4" aria-hidden>
      <CardHeader className="flex flex-row items-center justify-between pb-0">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="size-9" />
      </CardHeader>
      <CardContent className="grid gap-2">
        <Skeleton className="h-7 w-20" />
        <Skeleton className="h-3 w-32" />
      </CardContent>
    </Card>
  );
}

/** Atalho de cadastro: ícone, nome e número numa linha. */
export function TileSkeleton() {
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-card p-3" aria-hidden>
      <Skeleton className="size-9 shrink-0" />
      <div className="grid flex-1 gap-1.5"><Skeleton className="h-3.5 w-3/4" /><Skeleton className="h-3 w-1/3" /></div>
    </div>
  );
}

/** Linhas de tabela: cabeçalho e N linhas com larguras variadas. */
export function TableSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="grid gap-3" aria-hidden>
      <Skeleton className="h-4 w-full max-w-md opacity-70" />
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-4 border-t pt-3">
          <Skeleton className="h-4 w-1/3" /><Skeleton className="ml-auto h-4 w-12" /><Skeleton className="h-4 w-12" /><Skeleton className="h-4 w-24" />
        </div>
      ))}
    </div>
  );
}

/** Gráfico de colunas: barras de alturas diferentes sobre uma linha de base. */
export function ChartSkeleton({ className = 'h-72' }: { className?: string }) {
  const heights = [38, 62, 55, 70, 48, 30, 64, 52, 74, 44, 58, 36, 66, 50, 72, 40, 60, 54];
  return (
    <div className={`flex w-full items-end gap-1.5 border-b px-2 ${className}`} aria-hidden>
      {heights.map((h, i) => <Skeleton key={i} className="flex-1 rounded-b-none" style={{ height: `${h}%` }} />)}
    </div>
  );
}

/** Cartão de secção: título, descrição e o conteúdo (tabela por omissão). */
export function SectionSkeleton({ children }: { children?: React.ReactNode }) {
  return (
    <Card aria-hidden>
      <CardHeader className="gap-2"><Skeleton className="h-5 w-40" /><Skeleton className="h-3.5 w-72 max-w-full" /></CardHeader>
      <CardContent>{children ?? <TableSkeleton />}</CardContent>
    </Card>
  );
}

/** A dashboard inteira em esqueleto, com a mesma estrutura do conteúdo real. */
export function DashboardSkeleton() {
  return (
    <div role="status" aria-label="A carregar o painel" className="space-y-8">
      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">{Array.from({ length: 10 }, (_, i) => <TileSkeleton key={i} />)}</section>
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-3 2xl:grid-cols-6">{Array.from({ length: 6 }, (_, i) => <KpiSkeleton key={i} />)}</section>
      <SectionSkeleton><ChartSkeleton /></SectionSkeleton>
      <SectionSkeleton />
      <SectionSkeleton />
    </div>
  );
}
