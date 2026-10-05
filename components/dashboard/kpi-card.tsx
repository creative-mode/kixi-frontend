import type { LucideIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

/** Icon tile colours, straight from the design system's tint/ink pairs. */
const ACCENT = {
  brand: 'bg-accent text-primary',
  tiro: 'bg-warning-soft text-warning',
  radar: 'bg-info-soft text-info',
  pop: 'bg-accent text-primary',
  lila: 'bg-accent text-primary',
} as const;

interface Props {
  label: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
  accent?: keyof typeof ACCENT;
  loading?: boolean;
}

export function KpiCard({ label, value, hint, icon: Icon, accent = 'brand', loading }: Props) {
  return (
    <Card className="gap-4">
      <CardHeader className="flex flex-row items-center justify-between pb-0">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${ACCENT[accent]}`}
        >
          <Icon className="h-4 w-4" aria-hidden />
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-24" aria-label="A carregar" />
        ) : (
          <div className="text-xl font-bold leading-tight tabular-nums whitespace-nowrap text-foreground">{value}</div>
        )}
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}
