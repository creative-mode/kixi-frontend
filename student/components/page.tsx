import { cn } from '@/lib/utils';

const WIDTH = {
  feed: 'max-w-[1080px] xl:grid-cols-[minmax(0,1fr)_300px]',
  wide: 'max-w-[960px]',
  single: 'max-w-[760px]',
} as const;

/** Contentor de página: coluna única no telemóvel, e `feed` ganha painel lateral em ecrãs largos. */
export function Page({ variant = 'single', className, children }: { variant?: keyof typeof WIDTH; className?: string; children: React.ReactNode }) {
  return <div className={cn('mx-auto grid w-full items-start gap-7 p-4 pb-24 md:p-7 md:pb-12', WIDTH[variant], className)}>{children}</div>;
}

export function Column({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn('flex min-w-0 flex-col gap-4', className)}>{children}</div>;
}

export function PageHeader({ title, description, kicker }: { title: string; description?: string; kicker?: string }) {
  return (
    <div>
      {kicker && <p className="mb-1 text-sm text-muted-foreground">{kicker}</p>}
      <h1 className="text-[22px] leading-tight font-bold tracking-tight md:text-[26px]">{title}</h1>
      {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
    </div>
  );
}

/** Painel lateral: abaixo do conteúdo até `xl`, ao lado a partir daí. */
export function Rail({ children }: { children: React.ReactNode }) {
  return <aside className="grid gap-4 md:grid-cols-2 xl:sticky xl:top-6 xl:grid-cols-1">{children}</aside>;
}
