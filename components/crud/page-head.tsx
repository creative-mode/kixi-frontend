import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import type { Entity } from '@/lib/crud/entities';

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
  back?: { href: string; label: string };
  actions?: ReactNode;
}) {
  const Icon = entity.icon;
  return (
    <div className="mb-8">
      {back ? (
        <Link href={back.href} className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft size={14} /> {back.label}
        </Link>
      ) : null}
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <div className={`rounded-md p-2 ${entity.tone}`}>
            <Icon size={20} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground md:text-3xl">{title ?? entity.plural}</h1>
            <p className="text-sm text-muted-foreground">{subtitle ?? entity.description}</p>
          </div>
        </div>
        {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
      </div>
    </div>
  );
}
