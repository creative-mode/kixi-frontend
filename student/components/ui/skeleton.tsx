import { cn } from '@/lib/utils';

/** Marcador de carregamento do design system: bloco `muted` com varrimento de luz. Dá-lhe a forma do conteúdo real com className. */
function Skeleton({ className, children, ...props }: React.ComponentProps<'div'>) {
  return (
    <div data-slot="skeleton" aria-hidden={props['aria-label'] ? undefined : true} className={cn('relative overflow-hidden rounded-md bg-muted', className)} {...props}>
      <span className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-foreground/[.07] to-transparent" />
      {children}
    </div>
  );
}

/** Linhas de texto: a última é mais curta, como um parágrafo. */
function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn('grid gap-2', className)} aria-hidden>
      {Array.from({ length: lines }, (_, i) => <Skeleton key={i} className={cn('h-3.5', i === lines - 1 && lines > 1 ? 'w-2/3' : 'w-full')} />)}
    </div>
  );
}

export { Skeleton, SkeletonText };
