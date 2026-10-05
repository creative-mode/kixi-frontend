import { cn } from '@/lib/utils';

/** Indicador de progresso do design system: anel que herda a cor do texto (`text-primary`, `text-current`…). Para conteúdo que vai aparecer, prefira `Skeleton`. */
function Spinner({ className, ...props }: React.ComponentProps<'span'>) {
  return <span role="status" aria-label="A carregar" data-slot="spinner" className={cn('inline-block size-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent', className)} {...props} />;
}

export { Spinner };
