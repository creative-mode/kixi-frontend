import type { ReactNode } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import type { Entity } from '@/lib/crud/entities';
import { buildCrumbs } from '@/lib/nav-rules';

export function PageHead({
  entity,
  title,
  subtitle,
  back,
  actions,
}: {
  entity: Entity;
  title?: string;
  subtitle?: string;
  /** Presente nas páginas de detalhe: a ligação à lista passa a ser o 2.º nível do breadcrumb. */
  back?: { href: string; label: string };
  actions?: ReactNode;
}) {
  const Icon = entity.icon;
  const heading = title ?? entity.plural;
  return (
    <div className="mb-8">
      {back ? (
        <nav aria-label="Navegação estrutural" className="mb-4">
          <ol className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
            {buildCrumbs({ label: entity.plural, href: back.href }, heading).map((crumb, index) => (
              <li key={`${index}-${crumb.label}`} className="flex items-center gap-1.5">
                {index > 0 ? <ChevronRight size={14} aria-hidden="true" /> : null}
                {crumb.href ? (
                  <Link href={crumb.href} className="inline-flex min-h-8 items-center transition-colors hover:text-foreground">
                    {crumb.label}
                  </Link>
                ) : (
                  <span aria-current="page" className="font-medium text-foreground">
                    {crumb.label}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </nav>
      ) : null}
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <div className={`rounded-md p-2 ${entity.tone}`}>
            <Icon size={20} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground md:text-3xl">{heading}</h1>
            <p className="text-sm text-muted-foreground">{subtitle ?? entity.description}</p>
          </div>
        </div>
        {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
      </div>
    </div>
  );
}
