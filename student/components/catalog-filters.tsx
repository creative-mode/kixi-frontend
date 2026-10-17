'use client';

import { useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Os filtros do catálogo: no telemóvel ficam recolhidos atrás de um botão (com o número de filtros
 * ativos) para o primeiro resultado aparecer logo, e em ecrãs maiores estão sempre à vista.
 * Mudar um filtro aplica-o: não é preciso carregar em «Filtrar».
 */
export function CatalogFilters({ active, children }: { active: number; children: React.ReactNode }) {
  const [open, setOpen] = useState(active > 0);
  return (
    <div className="grid gap-3">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="filtros-catalogo"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex min-h-11 w-fit items-center gap-2 rounded-md border border-input bg-card px-3 text-sm font-semibold md:hidden"
      >
        <SlidersHorizontal className="size-4" aria-hidden />
        Filtros{active > 0 ? ` (${active})` : ''}
      </button>
      <div
        id="filtros-catalogo"
        className={cn('flex-wrap gap-3', open ? 'flex' : 'hidden', 'md:flex')}
        onChange={(e) => (e.target as HTMLElement).closest('form')?.requestSubmit()}
      >
        {children}
      </div>
    </div>
  );
}
