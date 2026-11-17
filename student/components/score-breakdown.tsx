import { Card } from '@/components/ui/card';
import { formatScore } from '@/lib/result-rules';

interface ScoreBreakdownProps {
  objectiveScore: number;
  objectiveMax: number;
  openScore: number;
  openMax: number;
  openPendingScore: number;
  openPendingMax: number;
  hasAiGraded: boolean;
  hasSchoolOpsGraded: boolean;
}

export function ScoreBreakdown({
  objectiveScore,
  objectiveMax,
  openScore,
  openMax,
  openPendingScore,
  openPendingMax,
  hasAiGraded,
  hasSchoolOpsGraded,
}: ScoreBreakdownProps) {
  const hasOpen = openMax > 0 || openPendingMax > 0;
  const openLabel = hasAiGraded ? ' (pela IA)' : hasSchoolOpsGraded ? ' (pelo SchoolOps)' : '';
  const pendingLabel = openPendingMax > 0 ? ` · ${openPendingScore} de ${openPendingMax} pendentes` : '';

  return (
    <div className="flex flex-wrap items-center gap-2">
      {objectiveMax > 0 && (
        <span className="inline-flex items-center gap-1.5 rounded-lg border border-primary/20 bg-primary/5 px-3 py-1.5 text-sm font-medium text-primary-foreground">
          <span className="font-bold">{formatScore(objectiveScore)}</span> de <span className="font-bold">{formatScore(objectiveMax)}</span> valores nas objectivas (pelo gabarito)
        </span>
      )}
      {hasOpen && (
        <span className="inline-flex items-center gap-1.5 rounded-lg border border-primary/20 bg-primary/5 px-3 py-1.5 text-sm font-medium text-primary-foreground">
          <span className="font-bold">{formatScore(openScore)}</span> de <span className="font-bold">{formatScore(openMax)}</span> valores nas abertas{openLabel}{pendingLabel}
        </span>
      )}
    </div>
  );
}
