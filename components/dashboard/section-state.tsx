'use client';

import type { ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { Section } from '@/types/analytics';

interface Props<T> {
  section: Section<T> | null;
  /** True when the loaded data has nothing to show (renders `empty` instead of children). */
  isEmpty?: (data: T) => boolean;
  empty?: ReactNode;
  onRetry: () => void;
  skeletonClassName?: string;
  children: (data: T) => ReactNode;
}

/** Loading, failed, empty and loaded states of one dashboard section. */
export function SectionState<T>({
  section,
  isEmpty,
  empty,
  onRetry,
  skeletonClassName = 'h-56',
  children,
}: Props<T>) {
  if (section === null) {
    return <Skeleton className={`w-full ${skeletonClassName}`} aria-label="A carregar" />;
  }

  if (!section.ok) {
    return (
      <div
        role="alert"
        className="flex flex-col items-center justify-center gap-3 rounded-[4px] border-2 border-dashed border-alvo-edge bg-alvo-tint px-4 py-10 text-center text-alvo-ink"
      >
        <AlertTriangle className="h-5 w-5" aria-hidden />
        <p className="text-sm font-medium">{section.error}</p>
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw className="h-3.5 w-3.5" aria-hidden />
          Tentar novamente
        </Button>
      </div>
    );
  }

  if (isEmpty?.(section.data)) {
    return (
      <div className="rounded-[4px] border-2 border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
        {empty ?? 'Sem dados para mostrar.'}
      </div>
    );
  }

  return <>{children(section.data)}</>;
}
