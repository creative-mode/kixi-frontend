import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowLeft, DoorOpen } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { STATUS_LABEL, type RoomStatus } from '@/lib/exam-rooms/model';

export const STATUS_VARIANT: Record<RoomStatus, 'secondary' | 'info' | 'success' | 'outline'> = {
  DRAFT: 'secondary',
  OPEN: 'info',
  RUNNING: 'success',
  CLOSED: 'outline',
};

export function RoomStatusBadge({ status }: { status: RoomStatus }) {
  return <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABEL[status]}</Badge>;
}

/** O cabeçalho das páginas das salas, no mesmo desenho do `PageHead` das listas. */
export function RoomHead({
  title,
  subtitle,
  back,
  actions,
}: {
  title: string;
  subtitle: ReactNode;
  back?: { href: string; label: string };
  actions?: ReactNode;
}) {
  return (
    <div className="mb-8">
      {back ? (
        <Link href={back.href} className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft size={14} /> {back.label}
        </Link>
      ) : null}
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex min-w-0 items-center gap-3">
          <div className="rounded-md bg-accent p-2 text-primary">
            <DoorOpen size={20} aria-hidden />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-bold text-foreground md:text-3xl">{title}</h1>
            <div className="text-sm text-muted-foreground">{subtitle}</div>
          </div>
        </div>
        {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
      </div>
    </div>
  );
}
