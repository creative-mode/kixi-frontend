import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

/** Contentor de página: a coluna central do Shell já limita a largura (600 px), por isso aqui só há o espaçamento. */
export function Page({ className, children }: { /** Mantido por compatibilidade: a largura é sempre a da coluna central. */ variant?: 'feed' | 'wide' | 'single'; className?: string; children: React.ReactNode }) {
  return <div className={cn('flex min-w-0 flex-col gap-4 p-4 pb-24 md:pb-10', className)}>{children}</div>;
}

export function Column({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn('flex min-w-0 flex-col gap-4', className)}>{children}</div>;
}

/** Cabeçalho colado ao topo da coluna, com fundo desfocado, como numa rede social. */
export function PageHeader({ title, description, kicker, back, className }: { className?: string; title: string; description?: string; kicker?: string; back?: string }) {
  return (
    <header className={cn('sticky top-14 z-10 -mx-4 -mt-4 flex items-center gap-3 border-b bg-background/85 px-4 py-2.5 backdrop-blur md:top-0', className)}>
      {back && (
        <Link href={back} aria-label="Voltar" className="grid size-9 shrink-0 place-items-center rounded-full transition-colors outline-none hover:bg-secondary focus-visible:ring-[3px] focus-visible:ring-ring/40">
          <ArrowLeft className="size-5" aria-hidden />
        </Link>
      )}
      <div className="min-w-0">
        {kicker && <p className="text-[13px] leading-tight text-muted-foreground">{kicker}</p>}
        <h1 className="truncate text-xl leading-tight font-bold tracking-tight">{title}</h1>
        {description && <p className="line-clamp-2 text-[13px] leading-snug text-muted-foreground">{description}</p>}
      </div>
    </header>
  );
}

/** Antes era um painel lateral por página; agora a coluna da direita é global (ver `RightRail`). Aqui só empilha. */
export function Rail({ children }: { children: React.ReactNode }) {
  return <aside className="grid gap-4">{children}</aside>;
}
