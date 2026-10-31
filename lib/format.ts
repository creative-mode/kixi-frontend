const int = new Intl.NumberFormat('pt-PT');
const decimal = new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 1, minimumFractionDigits: 1 });

export const EMPTY = '—';

const LUANDA = 'Africa/Luanda';
const luandaDateTime = new Intl.DateTimeFormat('pt-PT', {
  day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: LUANDA,
});

/** Format an instant in Luanda, independent of the browser's timezone. */
export function formatLuandaDateTime(value: string | Date | null | undefined): string {
  if (!value) return EMPTY;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? EMPTY : luandaDateTime.format(date);
}

/** Convert an instant to the wall-clock value expected by datetime-local. */
export function toLuandaDateTimeLocal(value: string | Date | null | undefined): string {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: LUANDA, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date);
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}`;
}

/** Interpret a datetime-local wall time as Luanda and return its ISO instant. */
export function fromLuandaDateTimeLocal(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const [, year, month, day, hour, minute] = match;
  const date = new Date(`${year}-${month}-${day}T${hour}:${minute}:00+01:00`);
  if (Number.isNaN(date.getTime()) || toLuandaDateTimeLocal(date) !== value) return null;
  return date.toISOString();
}

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
