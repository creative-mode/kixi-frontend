import Link from 'next/link';
import { Clock, GraduationCap } from 'lucide-react';
import { scorePassed, scorePercent, simulationHeadline } from '@/lib/feed-rules';
import { formatDuration, formatScore } from '@/lib/result-rules';
import { cn } from '@/lib/utils';

export interface SimulationCardData {
  simulationId?: number | null;
  statementId?: number | null;
  schoolName: string | null;
  statementTitle: string | null;
  /** O `examType` do enunciado («Teste», «Exame»…): com ele o cartão mostra o cabeçalho da folha (#602). */
  paperKind?: string | null;
  grade?: string | null;
  subject?: string | null;
  durationMinutes?: number | null;
  schoolYear?: string | null;
  variant?: string | null;
  finalScore: number | null;
  maxScore: number | null;
  correctAnswers: number | null;
  totalQuestions: number | null;
  timeSpentSeconds: number | null;
}

/** O cartão do resultado de uma prova simulada: o cabeçalho da folha (emblema,
 *  escola, identificação da prova) em miniatura e a nota em carimbo, como no ecrã
 *  de resultado. É o mesmo desenho na pré-visualização do resultado e no feed: o
 *  que o aluno vê antes de publicar é o que a turma vê depois.
 *
 *  Os campos do cabeçalho são opcionais: um backend antigo devolve só título,
 *  escola e nota, e aí o cartão degrada para o desenho antigo (só números). */
export function SimulationCard({ card }: { card: SimulationCardData }) {
  const percent = scorePercent(card.finalScore, card.maxScore);
  const passed = scorePassed(card.finalScore, card.maxScore);
  const score = formatScore(card.finalScore);
  const time = formatDuration(card.timeSpentSeconds);
  const headline = simulationHeadline(card);
  const stampTone =
    passed === null
      ? 'border-neutral-700 text-neutral-700'
      : passed
        ? 'border-green-800 text-green-800'
        : 'border-red-800 text-red-800';
  const stampWord = passed === null ? 'Sem cotação' : passed ? 'Positiva' : 'Negativa';
  const correctionHref = card.simulationId != null ? `/resultado?prova=${card.simulationId}` : null;

  return (
    <figure className="m-0 overflow-hidden rounded-lg border bg-card" aria-label="Resultado de prova simulada">
      <figcaption className="border-b bg-sidebar px-4 py-2.5 text-center text-sidebar-foreground">
        <p className="text-[11px] leading-tight font-semibold tracking-wide uppercase">República de Angola</p>
        <p className="text-[11px] leading-tight font-semibold tracking-wide uppercase">Ministério da Educação</p>
        <p className="mt-0.5 flex items-center justify-center gap-1.5 text-[13px] font-bold">
          <GraduationCap className="size-4 shrink-0 text-primary" aria-hidden />
          <span className="min-w-0 truncate">{card.schoolName ?? 'Escola'}</span>
        </p>
      </figcaption>
      <div className="grid gap-3 px-4 py-4">
        <div>
          <p className="text-sm leading-snug font-semibold">{card.statementTitle ?? 'Prova'}</p>
          {headline && <p className="mt-0.5 text-[12px] font-semibold tracking-wide text-muted-foreground uppercase">{headline}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div
            role="img"
            aria-label={`Nota: ${score ?? 'sem nota'}${card.maxScore != null ? ` de ${formatScore(card.maxScore)} valores` : ''}, ${stampWord.toLowerCase()}`}
            className={cn('grid rotate-[-4deg] place-items-center rounded-lg border-[3px] border-double px-4 py-1 text-center', stampTone)}
          >
            <span className="text-[34px] leading-none font-black tabular-nums" aria-hidden="true">{score ?? '—'}</span>
            <span className="text-[10px] font-bold tracking-wider uppercase" aria-hidden="true">
              {card.maxScore != null ? `de ${formatScore(card.maxScore)} valores` : 'valores'}
            </span>
            <span className="mt-0.5 text-[11px] font-black tracking-[0.2em] uppercase" aria-hidden="true">{stampWord}</span>
          </div>
          {percent != null && (
            <div className="grid min-w-28 flex-1 gap-1">
              <span className="text-base font-bold text-primary tabular-nums">{percent}%</span>
              <span className="h-1.5 w-full overflow-hidden rounded-full bg-border" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label={`${percent}% da cotação`}>
                <span className="block h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
              </span>
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-muted-foreground">
          {card.correctAnswers != null && card.totalQuestions != null && (
            <span><b className="text-foreground tabular-nums">{card.correctAnswers} de {card.totalQuestions}</b> respostas certas</span>
          )}
          {time && <span className="inline-flex items-center gap-1.5"><Clock className="size-3.5" aria-hidden />{time}</span>}
        </div>
        {correctionHref && (
          <Link href={correctionHref} className="inline-flex min-h-11 items-center text-[13px] font-semibold text-primary hover:underline">
            Ver a prova corrigida<span className="sr-only">: {card.statementTitle ?? 'prova'}</span>
          </Link>
        )}
      </div>
    </figure>
  );
}
