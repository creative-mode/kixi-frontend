'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { LogIn, RefreshCw, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ChartSkeleton, TableSkeleton } from './dashboard-skeleton';
import type { Section } from '@/types/analytics';

interface Props<T> {
  section: Section<T> | null;
  /** True when the loaded data has nothing to show (renders `empty` instead of children). */
  isEmpty?: (data: T) => boolean;
  empty?: ReactNode;
  onRetry: () => void;
  skeletonClassName?: string;
  /** Esqueleto em forma de gráfico em vez de tabela. */
  chart?: boolean;
  children: (data: T) => ReactNode;
}

/** Loading, failed, empty and loaded states of one dashboard section. */
export function SectionState<T>({
  section,
  isEmpty,
  empty,
  onRetry,
  skeletonClassName = 'h-56',
  chart = false,
  children,
}: Props<T>) {
  if (section === null) {
    return chart ? <ChartSkeleton className={skeletonClassName} /> : <TableSkeleton />;
  }

  if (!section.ok) {
    return <SectionError message={section.error} onRetry={onRetry} />;
  }

  if (isEmpty?.(section.data)) {
    return (
      <div className="rounded-md border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
        {empty ?? 'Sem dados para mostrar.'}
      </div>
    );
  }

  return <>{children(section.data)}</>;
}

/** Falhas de sessão (401/403) não são "erros" do painel: pedem apenas para entrar de novo. */
export function isAuthError(message: string) {
  return /Sessão expirada|Sem permissão/.test(message);
}

export function SectionError({ message, onRetry }: { message: string; onRetry: () => void }) {
  const auth = isAuthError(message);
  return (
    <div role="status" className="flex flex-col items-center justify-center gap-3 rounded-md border border-dashed bg-muted/40 px-4 py-10 text-center">
      {auth ? <LogIn className="h-5 w-5 text-muted-foreground" aria-hidden /> : <TriangleAlert className="h-5 w-5 text-warning" aria-hidden />}
      <p className="max-w-sm text-sm text-muted-foreground">{auth ? 'Para ver estes dados é preciso ter sessão iniciada.' : message}</p>
      {auth ? (
        <Button asChild size="sm"><Link href="/login"><LogIn className="h-3.5 w-3.5" aria-hidden />Iniciar sessão</Link></Button>
      ) : (
        <Button variant="outline" size="sm" onClick={onRetry}><RefreshCw className="h-3.5 w-3.5" aria-hidden />Tentar novamente</Button>
      )}
    </div>
  );
}
