import { Progress } from '@/components/ui/progress';

/** Barra de domínio de um tema (0-100). A cor segue o valor: vermelho abaixo de 40, âmbar abaixo de 65. */
export function Mastery({ label, value }: { label: string; value: number }) {
  const tone = value < 40 ? 'bg-destructive' : value < 65 ? 'bg-highlight' : 'bg-primary';
  return (
    <div className="grid gap-1.5">
      <div className="flex justify-between gap-3 text-sm"><span>{label}</span><b className="font-semibold tabular-nums">{value}%</b></div>
      <Progress value={value} aria-label={label} indicatorClassName={tone} />
    </div>
  );
}
