import type { SchoolYear } from './types';

/**
 * The school year a student is enrolling in right now.
 *
 * Not simply the one with the highest start year: a registry that opens 2027/2028 before
 * the current year has ended would make the onboarding offer only classes of a year that
 * has not started. The year that contains today wins, so we only fall back when the data
 * has no year covering today.
 *
 * Note this reads the current date, so the render is time-dependent. That is the point —
 * the answer is meant to change with the calendar — but it does mean a server render and a
 * render a year later disagree, which is correct rather than a hydration bug.
 */
export function currentSchoolYear(
  years: SchoolYear[],
  today: Date = new Date(),
): SchoolYear | undefined {
  if (years.length === 0) return undefined;

  const year = today.getFullYear();
  const byStartDesc = (a: SchoolYear, b: SchoolYear) => b.startYear - a.startYear;

  const containing = years
    .filter((s) => s.startYear <= year && year <= s.endYear)
    .sort(byStartDesc)[0];
  if (containing) return containing;

  // No year covers today: the most recent one that has already started, or the earliest
  // one if they have all not started yet.
  return (
    years.filter((s) => s.startYear <= year).sort(byStartDesc)[0] ??
    years.sort(byStartDesc).at(-1)
  );
}

export const schoolYearLabel = (year: SchoolYear) => `${year.startYear}/${year.endYear}`;