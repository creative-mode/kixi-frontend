'use client';

import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

/** Invólucro centrado para os três estados. Só tokens do design system. */
function Wrap({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div role="status" aria-label={label} className="grid justify-items-center gap-3 px-5 py-10 text-center">
      {children}
    </div>
  );
}

/** A carregar: anel + esqueletos. `lines` desenha barras de texto por baixo. */
export function LoadingState({ label = 'A carregar…', lines = 0, className }: { label?: string; lines?: number; className?: string }) {
  return (
    <Wrap label={label}>
      <Spinner className="size-8 text-primary" />
      <p className="text-sm text-muted-foreground">{label}</p>
      {lines > 0 && (
        <div className={cn('grid w-full max-w-sm gap-2', className)} aria-hidden>
          {Array.from({ length: lines }, (_, i) => (
            <Skeleton key={i} className={cn('h-3.5 w-full', i === lines - 1 && lines > 1 && 'w-2/3')} />
          ))}
        </div>
      )}
    </Wrap>
  );
}

/** Vazio: nada para mostrar — sem culpa, com chamada para a ação. */
export function EmptyState({
  title = 'Ainda não há nada aqui',
  message = 'Quando houver, aparece neste ecrã. Bom ritmo — continua assim.',
  action,
}: {
  title?: string;
  message?: string;
  action?: React.ReactNode;
}) {
  return (
    <Wrap label={title}>
      <p className="text-[15px] font-bold text-foreground">{title}</p>
      <p className="max-w-sm text-sm text-muted-foreground">{message}</p>
      {action}
    </Wrap>
  );
}

/** Erro: a API falhou ou não há rede — nunca ecrã branco, sempre com saída. */
export function ErrorState({
  title = 'Algo falhou, mas não perdeste nada',
  message = 'Verifica a ligação à internet e tenta de novo. Se continuar, fala com o teu professor.',
  onRetry,
  retryLabel = 'Tentar de novo',
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
  retryLabel?: string;
}) {
  return (
    <Wrap label={title}>
      <p className="text-[15px] font-bold text-foreground">{title}</p>
      <p className="max-w-sm text-sm text-muted-foreground">{message}</p>
      {onRetry && (
        <Button type="button" variant="outline" onClick={onRetry}>
          <RotateCcw aria-hidden />
          {retryLabel}
        </Button>
      )}
    </Wrap>
  );
}
