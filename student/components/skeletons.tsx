import { Column, Page, Rail } from '@/components/page';
import { Card } from '@/components/ui/card';
import { Skeleton, SkeletonText } from '@/components/ui/skeleton';

/** Cabeçalho de página (título + descrição). */
export function HeaderSkeleton({ kicker }: { kicker?: boolean }) {
  return (
    <div className="grid gap-2">
      {kicker && <Skeleton className="h-3.5 w-20" />}
      <Skeleton className="h-7 w-48 md:h-8" />
      <Skeleton className="h-3.5 w-64 max-w-full" />
    </div>
  );
}

function StatusLabel() {
  return <span className="sr-only" role="status">A carregar…</span>;
}

export function ExamCardSkeleton() {
  return (
    <Card className="gap-4 p-5">
      <div className="flex items-start gap-3">
        <Skeleton className="size-10 shrink-0 rounded-lg" />
        <div className="grid flex-1 gap-2"><Skeleton className="h-4 w-2/3" /><Skeleton className="h-3 w-1/3" /></div>
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <Skeleton className="h-2 w-full rounded-full" />
      <div className="flex gap-2"><Skeleton className="h-9 w-28" /><Skeleton className="h-9 w-24" /></div>
    </Card>
  );
}

export function PostSkeleton() {
  return (
    <Card className="gap-4 p-5">
      <div className="flex items-center gap-3">
        <Skeleton className="size-10 shrink-0 rounded-full" />
        <div className="grid flex-1 gap-2"><Skeleton className="h-3.5 w-32" /><Skeleton className="h-3 w-20" /></div>
      </div>
      <SkeletonText lines={3} />
    </Card>
  );
}

function RailCardSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <Card className="gap-4 p-5">
      <Skeleton className="h-4 w-28" />
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3"><Skeleton className="size-8 shrink-0 rounded-full" /><div className="grid flex-1 gap-1.5"><Skeleton className="h-3.5 w-3/4" /><Skeleton className="h-3 w-1/2" /></div></div>
      ))}
    </Card>
  );
}

export function InicioSkeleton() {
  return (
    <Page variant="feed">
      <StatusLabel />
      <Column>
        <Card className="gap-4 p-5"><Skeleton className="h-4 w-40" /><Skeleton className="h-6 w-3/4" /><Skeleton className="h-2 w-full rounded-full" /><Skeleton className="h-10 w-36" /></Card>
        <Card className="flex-row items-center gap-3 p-4"><Skeleton className="size-10 shrink-0 rounded-full" /><Skeleton className="h-10 flex-1" /></Card>
        <div className="flex gap-2"><Skeleton className="h-9 w-24" /><Skeleton className="h-9 w-24" /><Skeleton className="h-9 w-24" /></div>
        <PostSkeleton /><PostSkeleton />
      </Column>
      <Rail><RailCardSkeleton /><RailCardSkeleton /><RailCardSkeleton rows={2} /></Rail>
    </Page>
  );
}

export function ProvasSkeleton() {
  return (
    <Page variant="wide">
      <StatusLabel />
      <Column className="gap-5">
        <HeaderSkeleton />
        <Skeleton className="h-24 w-full rounded-xl" />
        <ExamCardSkeleton /><ExamCardSkeleton /><ExamCardSkeleton />
      </Column>
    </Page>
  );
}

export function RankingSkeleton() {
  return (
    <Page variant="wide">
      <StatusLabel />
      <Column className="gap-5">
        <HeaderSkeleton />
        <Card className="gap-0 py-0">
          <div className="flex items-center gap-4 border-b px-5 py-3"><Skeleton className="h-3 w-6" /><Skeleton className="h-3 w-24" /><span className="flex-1" /><Skeleton className="h-3 w-12" /><Skeleton className="h-3 w-12" /></div>
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="flex items-center gap-4 border-b px-5 py-3.5 last:border-0">
              <Skeleton className="h-4 w-6" /><Skeleton className="size-8 shrink-0 rounded-full" /><Skeleton className="h-4 w-40 max-w-[40%]" /><span className="flex-1" /><Skeleton className="h-4 w-10" /><Skeleton className="h-4 w-12" />
            </div>
          ))}
        </Card>
      </Column>
    </Page>
  );
}

export function TutorSkeleton() {
  return (
    <Page>
      <StatusLabel />
      <Column className="gap-5">
        <HeaderSkeleton />
        <Card className="min-h-[420px] gap-4 p-5">
          <div className="flex items-start gap-3"><Skeleton className="size-8 shrink-0 rounded-full" /><Skeleton className="h-16 w-3/4 rounded-xl" /></div>
          <div className="flex justify-end"><Skeleton className="h-10 w-1/2 rounded-xl" /></div>
          <div className="flex items-start gap-3"><Skeleton className="size-8 shrink-0 rounded-full" /><Skeleton className="h-24 w-4/5 rounded-xl" /></div>
          <span className="flex-1" />
          <div className="flex flex-wrap gap-2"><Skeleton className="h-8 w-32 rounded-full" /><Skeleton className="h-8 w-40 rounded-full" /></div>
          <Skeleton className="h-11 w-full" />
        </Card>
      </Column>
    </Page>
  );
}

export function PerfilSkeleton() {
  return (
    <Page>
      <StatusLabel />
      <Column className="gap-5">
        <Card className="gap-0 overflow-hidden py-0">
          <Skeleton className="h-28 w-full rounded-none" />
          <div className="grid gap-3 p-5"><Skeleton className="-mt-12 size-20 rounded-full ring-4 ring-card" /><Skeleton className="h-6 w-48" /><Skeleton className="h-3.5 w-64 max-w-full" /></div>
        </Card>
        <div className="grid gap-3 sm:grid-cols-3">{Array.from({ length: 3 }, (_, i) => <Card key={i} className="gap-2 px-4 py-3.5"><Skeleton className="h-6 w-16" /><Skeleton className="h-3 w-24" /></Card>)}</div>
        <RailCardSkeleton rows={4} />
      </Column>
    </Page>
  );
}

export function ResultadoSkeleton() {
  return (
    <Page>
      <StatusLabel />
      <Column className="gap-5">
        <HeaderSkeleton kicker />
        <div className="flex items-end gap-3.5"><Skeleton className="h-14 w-32 md:h-16" /><Skeleton className="mb-1.5 h-5 w-28" /></div>
        <div className="grid gap-3 sm:grid-cols-3">{Array.from({ length: 3 }, (_, i) => <Card key={i} className="gap-2 px-4 py-3.5"><Skeleton className="h-6 w-16" /><Skeleton className="h-3 w-28" /></Card>)}</div>
        <Card className="gap-4 p-5"><Skeleton className="h-4 w-36" />{Array.from({ length: 4 }, (_, i) => <div key={i} className="grid gap-1.5"><Skeleton className="h-3 w-1/3" /><Skeleton className="h-2 w-full rounded-full" /></div>)}</Card>
        <Card className="gap-0 py-0">{Array.from({ length: 3 }, (_, i) => <div key={i} className="flex items-center gap-3.5 border-b px-5 py-3.5 last:border-0"><Skeleton className="size-[34px] shrink-0" /><div className="grid flex-1 gap-1.5"><Skeleton className="h-3.5 w-3/4" /><Skeleton className="h-3 w-1/3" /></div></div>)}</Card>
      </Column>
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

/** Onboarding: a mesma coluna do AuthShell, com o select e o botão no sítio certo. */
export function OnboardingSkeleton() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 px-6 py-10">
      <span className="sr-only" role="status">A carregar os cursos…</span>
      <Skeleton className="h-7 w-28" />
      <div className="grid w-full max-w-[400px] gap-6 rounded-xl border bg-card p-6 shadow-xs sm:p-8">
        <div className="grid gap-2"><Skeleton className="h-7 w-40" /><Skeleton className="h-3.5 w-3/4" /></div>
        <div className="grid gap-6">
          <div className="flex items-center gap-2">
            <Skeleton className="size-6 rounded-full" />
            <Skeleton className="h-3.5 w-14" />
            <Skeleton className="h-px w-6" />
            <Skeleton className="size-6 rounded-full" />
            <Skeleton className="h-3.5 w-14" />
          </div>
          <div className="grid gap-2"><Skeleton className="h-3.5 w-32" /><Skeleton className="h-10 w-full" /><Skeleton className="h-3 w-48" /></div>
          <Skeleton className="h-11 w-full" />
        </div>
      </div>
    </main>
  );
}

/** Formulário de entrada/cadastro: mesma coluna centrada do AuthShell. */
export function AuthSkeleton({ fields = 2 }: { fields?: number }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 px-6 py-10">
      <span className="sr-only" role="status">A carregar…</span>
      <Skeleton className="h-7 w-28" />
      <div className="grid w-full max-w-[400px] gap-6 rounded-xl border bg-card p-6 shadow-xs sm:p-8">
        <div className="grid gap-2"><Skeleton className="h-7 w-32" /><Skeleton className="h-3.5 w-3/4" /></div>
        <div className="grid gap-5">
          {Array.from({ length: fields }, (_, i) => <div key={i} className="grid gap-2"><Skeleton className="h-3.5 w-24" /><Skeleton className="h-10 w-full" /></div>)}
          <Skeleton className="h-11 w-full" />
        </div>
      </div>
    </main>
  );
}
