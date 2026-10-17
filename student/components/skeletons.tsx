import { Page } from '@/components/page';
import { Card } from '@/components/ui/card';
import { Skeleton, SkeletonText } from '@/components/ui/skeleton';

function StatusLabel() {
  return <span className="sr-only" role="status">A carregar…</span>;
}

/** Cabeçalho fixo da coluna central. */
function HeaderSkeleton() {
  return (
    <div className="flex min-h-[53px] items-center border-b px-4"><div className="grid gap-1.5"><Skeleton className="h-5 w-32" /><Skeleton className="h-3 w-48 max-w-full" /></div></div>
  );
}

function TabsSkeleton({ n = 3 }: { n?: number }) {
  return <div className="flex h-[53px] items-center justify-around border-b">{Array.from({ length: n }, (_, i) => <Skeleton key={i} className="h-4 w-20" />)}</div>;
}

/** Linha de publicação: avatar à esquerda, texto e cartão à direita. */
export function PostSkeleton() {
  return (
    <div className="flex gap-3 border-b px-4 py-3.5">
      <Skeleton className="size-10 shrink-0 rounded-full" />
      <div className="grid flex-1 gap-2.5"><Skeleton className="h-3.5 w-44" /><SkeletonText lines={2} /><Skeleton className="h-16 w-full rounded-2xl" /></div>
    </div>
  );
}

function RowSkeleton() {
  return (
    <div className="flex items-center gap-3 border-b px-4 py-3.5">
      <Skeleton className="size-10 shrink-0 rounded-full" />
      <div className="grid flex-1 gap-1.5"><Skeleton className="h-4 w-2/3" /><Skeleton className="h-3 w-1/3" /></div>
      <Skeleton className="h-9 w-24 rounded-full" />
    </div>
  );
}

export function InicioSkeleton() {
  return (
    <Page>
      <StatusLabel />
      <TabsSkeleton />
      <div className="flex gap-3 border-b px-4 py-4"><Skeleton className="size-10 shrink-0 rounded-full" /><div className="grid flex-1 gap-4"><Skeleton className="h-6 w-56" /><div className="flex justify-between"><Skeleton className="h-8 w-32" /><Skeleton className="h-9 w-24 rounded-full" /></div></div></div>
      <PostSkeleton /><PostSkeleton /><PostSkeleton />
    </Page>
  );
}

export function ProvasSkeleton() {
  return (
    <Page>
      <StatusLabel />
      <HeaderSkeleton />
      <div className="grid gap-3 border-b px-4 py-4"><Skeleton className="h-20 w-full rounded-2xl" /><Skeleton className="h-11 w-full rounded-full" /></div>
      <TabsSkeleton n={4} />
      <RowSkeleton /><RowSkeleton /><RowSkeleton /><RowSkeleton />
    </Page>
  );
}

export function RankingSkeleton() {
  return (
    <Page>
      <StatusLabel />
      <HeaderSkeleton />
      <div className="grid gap-3 border-b px-4 py-4"><Skeleton className="h-9 w-48" /><Skeleton className="h-1.5 w-full rounded-full" /><Skeleton className="h-3.5 w-3/4" /></div>
      <TabsSkeleton />
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="flex items-center gap-3 border-b px-4 py-3.5"><Skeleton className="h-4 w-6" /><Skeleton className="size-10 shrink-0 rounded-full" /><div className="grid flex-1 gap-1.5"><Skeleton className="h-4 w-40 max-w-[50%]" /><Skeleton className="h-3 w-20" /></div><Skeleton className="h-4 w-10" /></div>
      ))}
    </Page>
  );
}

export function TutorSkeleton() {
  return (
    <Page>
      <StatusLabel />
      <HeaderSkeleton />
      <div className="grid gap-4 px-4 py-4">
        <div className="flex items-start gap-3"><Skeleton className="size-9 shrink-0 rounded-full" /><Skeleton className="h-16 w-3/4 rounded-2xl" /></div>
        <div className="flex justify-end"><Skeleton className="h-10 w-1/2 rounded-2xl" /></div>
        <div className="flex items-start gap-3"><Skeleton className="size-9 shrink-0 rounded-full" /><Skeleton className="h-24 w-4/5 rounded-2xl" /></div>
        <div className="flex flex-wrap gap-2"><Skeleton className="h-8 w-32 rounded-full" /><Skeleton className="h-8 w-40 rounded-full" /></div>
        <Skeleton className="h-11 w-full rounded-full" />
      </div>
    </Page>
  );
}

export function PerfilSkeleton() {
  return (
    <Page>
      <StatusLabel />
      <HeaderSkeleton />
      <Skeleton className="h-32 w-full rounded-none" />
      <div className="grid gap-3 px-4 pb-4"><div className="flex items-end justify-between"><Skeleton className="-mt-12 size-24 rounded-full ring-4 ring-background" /><Skeleton className="h-10 w-32 rounded-full" /></div><Skeleton className="h-6 w-48" /><Skeleton className="h-3.5 w-64 max-w-full" /></div>
      <TabsSkeleton />
      <RowSkeleton /><RowSkeleton /><RowSkeleton />
    </Page>
  );
}

export function ResultadoSkeleton() {
  return (
    <Page>
      <StatusLabel />
      <HeaderSkeleton />
      <div className="flex items-end gap-3.5 border-b px-4 py-4"><Skeleton className="h-14 w-32" /><Skeleton className="mb-1.5 h-5 w-28" /></div>
      <div className="grid grid-cols-3 divide-x border-b">{Array.from({ length: 3 }, (_, i) => <div key={i} className="grid gap-2 px-4 py-3.5"><Skeleton className="h-6 w-16" /><Skeleton className="h-3 w-20" /></div>)}</div>
      <div className="grid gap-4 border-b px-4 py-4"><Skeleton className="h-5 w-36" />{Array.from({ length: 3 }, (_, i) => <div key={i} className="grid gap-1.5"><Skeleton className="h-3 w-1/3" /><Skeleton className="h-2 w-full rounded-full" /></div>)}</div>
      <RowSkeleton /><RowSkeleton />
    </Page>
  );
}

export function ProvaSkeleton() {
  return (
    <div className="flex min-h-dvh flex-col">
      <span className="sr-only" role="status">A carregar a prova…</span>
      <header className="flex items-center gap-3 border-b bg-card px-4 py-2.5 md:px-5">
        <Skeleton className="size-9" />
        <div className="grid gap-1.5"><Skeleton className="h-4 w-44" /><Skeleton className="h-3 w-28" /></div>
        <span className="flex-1" /><Skeleton className="h-6 w-20" /><Skeleton className="h-8 w-20" />
      </header>
      <div className="mx-auto grid w-full max-w-[1040px] flex-1 items-start gap-6 p-4 md:grid-cols-[minmax(0,1fr)_280px] md:p-6">
        <Card className="gap-5 p-5 md:p-6">
          <div className="flex justify-between"><Skeleton className="h-3.5 w-32" /><Skeleton className="h-3.5 w-20" /></div>
          <SkeletonText lines={3} />
          <div className="grid gap-2.5">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}</div>
          <div className="flex gap-2.5"><Skeleton className="h-9 w-28" /><span className="flex-1" /><Skeleton className="h-9 w-28" /></div>
        </Card>
        <Card className="gap-4 p-5"><Skeleton className="h-4 w-24" /><div className="grid grid-cols-6 gap-2">{Array.from({ length: 18 }, (_, i) => <Skeleton key={i} className="aspect-square" />)}</div></Card>
      </div>
    </div>
  );
}

/** Formulário de entrada/cadastro: mesma coluna centrada do AuthShell. */
export function AuthSkeleton({ fields = 2 }: { fields?: number }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 px-6 py-10">
      <span className="sr-only" role="status">A carregar…</span>
      <Skeleton className="h-7 w-28" />
      <div className="grid w-full max-w-[400px] gap-6 rounded-2xl border bg-card p-6 sm:p-8">
        <div className="grid gap-2"><Skeleton className="h-7 w-32" /><Skeleton className="h-3.5 w-3/4" /></div>
        <div className="grid gap-5">
          {Array.from({ length: fields }, (_, i) => <div key={i} className="grid gap-2"><Skeleton className="h-3.5 w-24" /><Skeleton className="h-10 w-full" /></div>)}
          <Skeleton className="h-11 w-full" />
        </div>
      </div>
    </main>
  );
}
