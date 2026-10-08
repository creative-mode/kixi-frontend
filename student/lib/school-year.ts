import type { SchoolYear } from './types';

/**
 * The month the academic year starts in, zero-based: 8 is September.
 *
 * The backend stores a school year as two integers, so 2025/2026 covers both halves of
 * 2025 and 2026 and there is no way to tell from the data alone which side of the civil
 * year we are on. In March 2026 both 2025/2026 and 2026/2027 "contain" 2026, and picking
 * the one with the highest start year would offer a year that has not started yet.
 *
 * September is the Portuguese academic year, which is the school this project serves.
 * A school with a different calendar passes its own month. The real fix is for the backend
 * to store real start and end dates; until then this is the honest approximation, and it
 * is a parameter rather than a hidden constant so the assumption is visible.
 */
export const ACADEMIC_YEAR_START_MONTH = 8;

/**
 * The school year a student is enrolling in right now.
 *
 * Picks the year that covers today *and* that has already started. When no year covers
 * today, falls back to the most recent one already started, and then to the earliest one,
 * for the case where none has started yet.
 *
 * Reads the current date, so the render is time-dependent. That is the point — the answer is
 * meant to change with the calendar — but it does mean a server render and a render months
 * later disagree, which is correct rather than a hydration bug.
 */
export function currentSchoolYear(
  years: SchoolYear[],
  today: Date = new Date(),
  startMonth: number = ACADEMIC_YEAR_START_MONTH,
): SchoolYear | undefined {
  if (years.length === 0) return undefined;

  const year = today.getFullYear();
  const month = today.getMonth(); // zero-based

  /** Has this school year already begun, given the academic year starts in `startMonth`? */
  const hasStarted = (s: SchoolYear) =>
    s.startYear < year || (s.startYear === year && month >= startMonth);

  const byStartDesc = [...years].sort((a, b) => b.startYear - a.startYear);

  const containing = byStartDesc.find((s) => s.startYear <= year && year <= s.endYear && hasStarted(s));
  if (containing) return containing;

  return byStartDesc.find(hasStarted) ?? byStartDesc.at(-1);
}

export const schoolYearLabel = (year: SchoolYear) => `${year.startYear}/${year.endYear}`;