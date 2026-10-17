import { BadgeCheck } from 'lucide-react';

/** O selo de verificação. Leva sempre texto para leitores de ecrã: a cor não carrega o sentido. */
export function VerifiedBadge({ label = 'Verificada', className }: { label?: string; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 text-primary ${className ?? ''}`} title={label}>
      <BadgeCheck className="size-4" aria-hidden />
      <span className="sr-only">{label}</span>
    </span>
  );
}
