import type { Institution } from '../types';

/**
 * Which school the `/me` answers with.
 *
 * The school of the enrolled class wins over the administrator link, exactly as
 * `MeService.resolveSchool` does: showing one school next to the course and class of
 * another reads as a mistake on the screen. The link only fills the gap, which is what
 * makes a student who enrolled themselves answer with a school instead of null.
 *
 * It lives in its own module because `mock/backend.ts` starts with `import 'server-only'`,
 * which a plain `node --test` cannot resolve — and a rule that cannot be tested is a rule
 * that was once the wrong way round without anybody noticing.
 */
export function resolveSchoolId(
  fromClass: Institution | undefined,
  linked: Institution | undefined,
): Institution | undefined {
  return fromClass ?? linked;
}
