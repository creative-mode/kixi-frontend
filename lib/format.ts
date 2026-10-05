const int = new Intl.NumberFormat('pt-PT');
const decimal = new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 1, minimumFractionDigits: 1 });

export const EMPTY = '—';

export function formatInt(value: number | null | undefined): string {
  return value == null ? EMPTY : int.format(value);
}

/** 0–100 → "27,5%". null means no data and stays a dash, never "0%". */
export function formatPercent(value: number | null | undefined): string {
  return value == null ? EMPTY : `${decimal.format(value)}%`;
}

/** Seconds → "45 s", "12 min", "1 h 05 min". */
export function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null) return EMPTY;
  const total = Math.round(seconds);
  if (total < 60) return `${total} s`;
  const minutes = Math.round(total / 60);
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h} h ${String(m).padStart(2, '0')} min`;
}

/** yyyy-MM-dd → "04 out" (parsed as a calendar date, so the timezone cannot shift the day). */
export function formatDay(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('pt-PT', {
    day: '2-digit',
    month: 'short',
    timeZone: 'UTC',
  });
}

export type ScoreTone = 'good' | 'ok' | 'low' | 'none';

/** Traffic-light bucket for a percentage; the number is always shown next to it. */
export function scoreTone(percent: number | null | undefined): ScoreTone {
  if (percent == null) return 'none';
  if (percent >= 70) return 'good';
  if (percent >= 50) return 'ok';
  return 'low';
}

// Design-system tokens: primary = good, warning = borderline, destructive = low.
export const TONE_TEXT: Record<ScoreTone, string> = {
  good: 'text-primary',
  ok: 'text-warning',
  low: 'text-destructive',
  none: 'text-muted-foreground',
};

export const TONE_BAR: Record<ScoreTone, string> = {
  good: 'bg-primary',
  ok: 'bg-warning',
  low: 'bg-destructive',
  none: 'bg-muted',
};
