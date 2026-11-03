'use client';

import { Button } from '@/components/ui/button';
import type { Paged } from '@/lib/queue-state';

/** «11 a 20 de 41 denúncias» e Anterior/Seguinte. Não aparece quando tudo cabe numa página. */
export function Pagination({ paged, noun, onPage }: { paged: Paged<unknown>; noun: string; onPage: (page: number) => void }) {
  if (paged.pages <= 1) return null;
  return (
    <nav aria-label="Paginação" className="mt-4 flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-muted-foreground" role="status">
        {paged.first} a {paged.last} de {paged.total} {noun}
      </p>
      <div className="flex items-center gap-2">
        <Button type="button" size="sm" variant="outline" disabled={paged.page <= 1} onClick={() => onPage(paged.page - 1)}>Anterior</Button>
        <span className="text-sm tabular-nums">Página {paged.page} de {paged.pages}</span>
        <Button type="button" size="sm" variant="outline" disabled={paged.page >= paged.pages} onClick={() => onPage(paged.page + 1)}>Seguinte</Button>
      </div>
    </nav>
  );
}
