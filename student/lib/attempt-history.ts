/**
 * Which attempts belong on the detail screen, as the catalog's card rule.
 *
 * Kept free of `server-only` so `node --test` can cover it, the same reason
 * `mock/catalog-page.ts` is its own module: `mock/backend.ts` starts with
 * `import 'server-only'`, which a plain `node --test` cannot resolve, and a rule
 * that cannot be tested is a rule that was once the wrong way round without
 * anybody noticing.
 *
 * The card and this screen must agree on what counts as "the" attempt. Picking a
 * different one is how the same exam ends up in progress on the list and finished
 * in the detail.
 */

/** A simulation as `GET /simulations` returns it for the signed-in student. */
export interface Attempt {
  id: number;
  status?: string | null;
  finalScore?: number | null;
  /** ISO date from `startedAt`, when the backend sends one. */
  startedAt?: string | null;
}

export const inProgress = (a: Attempt) => (a.status ?? '').toUpperCase() === 'IN_PROGRESS';

export const isFinished = (a: Attempt) => (a.status ?? '').toUpperCase() === 'FINISHED';

/** Cancelled by the student through `PUT /simulations/{id}`. */
export const isCancelled = (a: Attempt) => (a.status ?? '').toUpperCase() === 'CANCELLED';

/** Anything the backend adds later is treated as unfinished rather than finished:
 *  claiming a score that is not there is worse than saying nothing. */
export const settled = (a: Attempt) => isFinished(a) || isCancelled(a);

/**
 * The attempt the card and the detail both speak about: the one in progress if there
 * is one (there is a paper to finish), otherwise the most recent. Never mixes a score
 * from one attempt with progress from another.
 *
 * A cancelled attempt is settled, so it never becomes "the" attempt when a newer one
 * exists — but it is not finished either, so a card never offers "Ver resultado" for
 * an attempt that was never corrected.
 */
export function currentAttempt(attempts: Attempt[]): Attempt | null {
  if (attempts.length === 0) return null;
  return attempts.find(inProgress) ?? attempts.reduce((a, b) => (b.id > a.id ? b : a));
}

/**
 * The history to show, most recent first.
 *
 * Sorted by id descending because that is the order the backend hands them out in
 * and the only one it guarantees; `startedAt` is not on every response and sorting
 * on it would silently reorder when it is missing. Finished ones carry the score,
 * and a score of zero is a score — only a missing one is absent.
 */
export function history(attempts: Attempt[]): Attempt[] {
  return [...attempts].sort((a, b) => b.id - a.id);
}

export function formatScore(score: number | null | undefined): string | undefined {
  if (score == null) return undefined;
  return String(score).replace('.', ',');
}

/** What the screen calls an attempt. Kept here so the card and the detail cannot
 *  disagree about it — which is how the same paper ends up "done" in one place and
 *  "in progress" in the other. */
export type AttemptLabel = 'corrected' | 'unfinished' | 'cancelled';

export function labelOf(a: Attempt): AttemptLabel {
  if (isCancelled(a)) return 'cancelled';
  if (isFinished(a)) return 'corrected';
  return 'unfinished';
}

/** "há 2 dias", from an ISO date. Absent or unparseable means we cannot say. */
export function sinceLabel(startedAt: string | null | undefined): string | undefined {
  if (!startedAt) return undefined;
  const then = Date.parse(startedAt);
  if (!Number.isFinite(then)) return undefined;
  const minutes = Math.max(0, Math.floor((Date.now() - then) / 60000));
  if (minutes < 1) return 'agora mesmo';
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'há 1 dia';
  if (days < 30) return `há ${days} dias`;
  const months = Math.round(days / 30);
  return months <= 1 ? 'há 1 mês' : `há ${months} meses`;
}
