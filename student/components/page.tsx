import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Conteúdo de uma página dentro da coluna central do Shell. */
export function Page({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn('pb-24 md:pb-8', className)}>{children}</div>;
}

/** Cabeçalho fixo da coluna central: título, subtítulo e seta de voltar. `children` vai à direita. */
export function PageHeader({ title, subtitle, back, children }: { title: string; subtitle?: string; back?: string; children?: React.ReactNode }) {
  return (
    <header className="sticky top-14 z-10 flex min-h-[53px] items-center gap-5 border-b bg-background/85 px-4 py-1.5 backdrop-blur md:top-0">
      {back && (
        <Link href={back} aria-label="Voltar" className="-ml-2 grid size-9 place-items-center rounded-full hover:bg-secondary"><ArrowLeft className="size-5" /></Link>
      )}
      <div className="min-w-0 flex-1 leading-tight">
        <h1 className="truncate text-xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="truncate text-[13px] text-muted-foreground">{subtitle}</p>}
      </div>
      {children}
    </header>
  );
}

/** Bloco separado por uma linha fina, como as secções de uma página de perfil. */
export function Section({ title, className, children }: { title?: string; className?: string; children: React.ReactNode }) {
  return (
    <section className={cn('border-b px-4 py-4', className)}>
      {title && <h2 className="mb-3 text-xl font-bold tracking-tight">{title}</h2>}
      {children}
    </section>
  );
}
