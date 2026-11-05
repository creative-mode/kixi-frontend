import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Ico } from '@/components/ui/ico';
import { cn } from '@/lib/utils';
import type { StudyPlan, StudyPlanStep } from '@/lib/study-plan-rules';

function StepRow({ step, last }: { step: StudyPlanStep; last: boolean }) {
  return (
    <li className="grid grid-cols-[24px_minmax(0,1fr)] gap-3.5">
      <div className="flex flex-col items-center">
        {step.status === 'done' ? (
          <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground"><Ico name="check" size={12} /></span>
        ) : step.status === 'current' ? (
          <span className="grid size-6 shrink-0 place-items-center rounded-full border-[3px] border-primary bg-card"><span className="size-2 rounded-full bg-primary" /></span>
        ) : (
          <span className="size-6 shrink-0 rounded-full border-2 border-input bg-card" />
        )}
        {!last && <span className={cn('mt-0.5 min-h-3.5 w-0.5 flex-1', step.status === 'done' ? 'bg-primary' : 'bg-border')} aria-hidden />}
      </div>
      <div className={cn('flex flex-col gap-1', last ? 'pb-1' : 'pb-4')}>
        <div className="flex items-start justify-between gap-2">
          <p className={cn('text-[15px] font-bold', step.status === 'future' && 'text-muted-foreground')}>{step.title}</p>
          {step.status === 'done' && step.href && step.linkLabel && (
            <Link href={step.href} className="shrink-0 text-[13px] font-bold text-primary hover:underline">{step.linkLabel}</Link>
          )}
        </div>
        <p className="text-[13px] leading-snug text-muted-foreground">{step.description}</p>
        {step.status === 'current' && step.href && step.linkLabel && (
          <Button asChild className="mt-1.5 w-fit"><Link href={step.href}>{step.linkLabel}</Link></Button>
        )}
      </div>
    </li>
  );
}

/**
 * O "plano até à prova" (kixi#728): a próxima sala de prova agendada, com um percurso de 4
 * passos até lá — diagnóstico, treino do tema mais fraco, simulação e a prova. Fecha-se por
 * omissão (`<details>`); o professor que ainda não abriu a sala não muda o que aqui se mostra.
 */
export function StudyPlanCard({ plan }: { plan: StudyPlan }) {
  const doneCount = plan.steps.filter((s) => s.status === 'done').length;
  return (
    <details className="group overflow-hidden rounded-2xl border bg-card">
      <summary className="flex min-h-16 cursor-pointer list-none items-center gap-3.5 px-4 py-3 [&::-webkit-details-marker]:hidden">
        <div aria-hidden="true" className="w-14 shrink-0 overflow-hidden rounded-xl border text-center">
          <div className="bg-destructive py-0.5 text-[11px] font-bold text-destructive-foreground uppercase">{plan.month}</div>
          <div className="py-1 text-[26px] leading-none font-extrabold tracking-tight">{plan.day}</div>
        </div>
        <div className="min-w-0 flex-1">
          <span className="inline-flex h-5 items-center rounded-full bg-accent px-2.5 text-[11px] font-bold text-accent-foreground">{plan.daysLabel}</span>
          <h2 className="mt-1 truncate text-[19px] leading-tight font-extrabold tracking-tight">{plan.title}</h2>
          <p className="text-[13px] text-muted-foreground">{plan.meta}</p>
        </div>
        <span className="flex shrink-0 flex-col items-center gap-0.5 text-muted-foreground">
          <Ico name="chevron" size={18} className="rotate-90 transition-transform group-open:-rotate-90" />
          <span className="text-[11px] font-bold">Ver plano</span>
        </span>
      </summary>
      <div className="border-t px-4 py-4">
        <div className="mb-3 flex items-baseline justify-between gap-2">
          <h3 className="text-[16px] font-extrabold tracking-tight">O teu plano até à prova</h3>
          <span className="shrink-0 text-[13px] font-semibold text-muted-foreground tabular-nums">{doneCount} de {plan.steps.length}</span>
        </div>
        <ol className="grid">
          {plan.steps.map((step, i) => <StepRow key={step.id} step={step} last={i === plan.steps.length - 1} />)}
        </ol>
      </div>
    </details>
  );
}
