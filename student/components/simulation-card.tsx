import { Clock, GraduationCap } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { scorePercent } from '@/lib/feed-rules';
import { formatDuration, formatScore } from '@/lib/result-rules';

export interface SimulationCardData {
  schoolName: string | null;
  statementTitle: string | null;
  finalScore: number | null;
  maxScore: number | null;
  correctAnswers: number | null;
  totalQuestions: number | null;
  timeSpentSeconds: number | null;
}

/** O cartão do resultado de uma prova simulada, com o nome da escola no topo como numa folha
 *  de prova. É o mesmo desenho na pré-visualização do resultado e no feed: o que o aluno
 *  vê antes de publicar é o que a turma vê depois. */
export function SimulationCard({ card }: { card: SimulationCardData }) {
  const percent = scorePercent(card.finalScore, card.maxScore);
  const score = formatScore(card.finalScore);
  const time = formatDuration(card.timeSpentSeconds);
  return (
    <figure className="m-0 overflow-hidden rounded-lg border bg-card" aria-label="Resultado de prova simulada">
      <figcaption className="flex items-center gap-2 border-b bg-sidebar px-4 py-2.5 text-[13px] font-semibold text-sidebar-foreground">
        <GraduationCap className="size-4 shrink-0 text-primary" aria-hidden />
        <span className="min-w-0 flex-1 truncate">{card.schoolName ?? 'Escola'}</span>
        <span className="shrink-0 text-xs font-bold tracking-wide text-primary uppercase">Prova simulada</span>
      </figcaption>
      <div className="grid gap-3 px-4 py-4">
        <p className="text-sm leading-snug font-semibold">{card.statementTitle ?? 'Prova'}</p>
        <div className="flex flex-wrap items-end gap-x-3 gap-y-1">
          <span className="text-[44px] leading-[.95] font-bold tracking-tighter tabular-nums">{score ?? '—'}</span>
          {card.maxScore != null && (
            <span className="pb-1 text-base font-semibold text-muted-foreground">de {formatScore(card.maxScore)} valores</span>
          )}
          {percent != null && <span className="ml-auto pb-1 text-base font-bold text-primary tabular-nums">{percent}%</span>}
        </div>
        {percent != null && <Progress value={percent} aria-label={`${percent}% da cotação`} />}
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-muted-foreground">
          {card.correctAnswers != null && card.totalQuestions != null && (
            <span><b className="text-foreground tabular-nums">{card.correctAnswers} de {card.totalQuestions}</b> respostas certas</span>
          )}
          {time && <span className="inline-flex items-center gap-1.5"><Clock className="size-3.5" aria-hidden />{time}</span>}
        </div>
      </div>
    </figure>
  );
}
