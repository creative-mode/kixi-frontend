import { formatScore } from '@/lib/result-rules';

interface ScoreBreakdownProps {
  objectiveScore: number;
  /** Falso quando as objetivas ainda não têm nota (sala aberta): diz-se «a aguardar», não «0/20». */
  objectiveGraded?: boolean;
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
  objectiveGraded = true,
  objectiveMax,
  openScore,
  openMax,
  openPendingMax,
  hasAiGraded,
  hasSchoolOpsGraded,
}: ScoreBreakdownProps) {
  const hasOpen = openMax > 0 || openPendingMax > 0;
  // O aluno não conhece "SchoolOps": diz-se "pela escola". A IA diz-se "pela IA".
  const openLabel = hasAiGraded ? 'pela IA' : hasSchoolOpsGraded ? 'pela escola' : '';
  // Só há «pendentes» ao lado de abertas já corrigidas; sem nenhuma corrigida a frase é «a aguardar a correção».
  const pendingLabel = openPendingMax > 0 && openMax > 0 ? ` · mais ${formatScore(openPendingMax)} a aguardar a correção` : '';

  if (objectiveMax <= 0 && !hasOpen) return null;

  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm font-medium text-primary">
      {objectiveMax > 0 && (
        <span>
          {objectiveGraded ? (
            <>Objetivas <b className="font-bold">{formatScore(objectiveScore)}</b>/{formatScore(objectiveMax)} pelo gabarito</>
          ) : (
            <>Objetivas <b className="font-bold">a aguardar a correção</b> (valem {formatScore(objectiveMax)})</>
          )}
        </span>
      )}
      {objectiveMax > 0 && hasOpen && <span className="text-muted-foreground" aria-hidden>·</span>}
      {hasOpen && (
        <span>
          {openMax > 0 ? (
            <>Abertas <b className="font-bold">{formatScore(openScore)}</b>/{formatScore(openMax)}{openLabel ? ` ${openLabel}` : ''}{pendingLabel}</>
          ) : (
            <>Abertas <b className="font-bold">a aguardar a correção</b> (valem {formatScore(openPendingMax)})</>
          )}
        </span>
      )}
    </p>
  );
}