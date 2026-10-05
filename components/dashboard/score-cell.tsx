import { TONE_BAR, TONE_TEXT, formatPercent, scoreTone } from '@/lib/format';

/** A percentage with a small bar. The number carries the meaning; colour only reinforces it. */
export function ScoreCell({ percent }: { percent: number | null | undefined }) {
  const tone = scoreTone(percent);
  return (
    <div className="flex items-center justify-end gap-2">
      <div className="hidden h-2 w-16 overflow-hidden border border-border bg-muted sm:block" aria-hidden>
        <div
          className={`h-full ${TONE_BAR[tone]}`}
          style={{ width: `${Math.max(0, Math.min(100, percent ?? 0))}%` }}
        />
      </div>
      <span className={`w-14 text-right font-semibold tabular-nums ${TONE_TEXT[tone]}`}>
        {formatPercent(percent)}
      </span>
    </div>
  );
}
