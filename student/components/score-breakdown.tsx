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
  // O aluno não conhece "SchoolOps": diz-se "pela escola". A IA diz-se "pela IA".
  const openLabel = hasAiGraded ? 'pela IA' : hasSchoolOpsGraded ? 'pela escola' : '';
  const pendingLabel = openPendingMax > 0 ? ` · ${openPendingScore} de ${openPendingMax} pendentes` : '';

  if (objectiveMax <= 0 && !hasOpen) return null;

  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm font-medium text-primary">
      {objectiveMax > 0 && (
        <span>
          Objectivas <b className="font-bold">{formatScore(objectiveScore)}</b>/{formatScore(objectiveMax)} pelo gabarito
        </span>
      )}
      {objectiveMax > 0 && hasOpen && <span className="text-muted-foreground" aria-hidden>·</span>}
      {hasOpen && (
        <span>
          Abertas <b className="font-bold">{formatScore(openScore)}</b>/{formatScore(openMax)}{openLabel ? ` ${openLabel}` : ''}{pendingLabel}
        </span>
      )}
    </p>
  );
}