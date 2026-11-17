import { Card } from '@/components/ui/card';
import { formatScore } from '@/lib/result-rules';

interface ScoreBreakdownProps {
  objectiveScore: number;
  objectiveMax: number;
  openScore: number;
  openMax: number;
  hasAiGraded: boolean;
}

export function ScoreBreakdown({ objectiveScore, objectiveMax, openScore, openMax, hasAiGraded }: ScoreBreakdownProps) {
  return (
    <div>
      {objectiveMax > 0 && (
        <Card className="gap-2 p-3 sm:p-4 border-blue-200 bg-blue-50">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="flex items-center gap-1.5 font-medium text-blue-800">
              <span className="font-bold">{formatScore(objectiveScore)}</span> de <span className="font-bold">{formatScore(objectiveMax)}</span> valores nas objectivas (pelo gabarito)
            </span>
          </div>
        </Card>
      )}
      {openMax > 0 && (
        <Card className="gap-2 p-3 sm:p-4 border-blue-200 bg-blue-50">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="flex items-center gap-1.5 font-medium text-blue-800">
              <span className="font-bold">{formatScore(openScore)}</span> de <span className="font-bold">{formatScore(openMax)}</span> valores nas abertas{hasAiGraded ? ' (pela IA)' : ''}
            </span>
          </div>
        </Card>
      )}
    </div>
  );
}