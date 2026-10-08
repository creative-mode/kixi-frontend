import type { Me } from './types';

/** Full name, with the username as a last resort so the header is never blank. */
export function fullName(me: Me | null): string {
  if (!me) return '';
  const name = [me.first_name, me.last_name].filter(Boolean).join(' ').trim();
  return name || me.username;
}

/** The academic context line: "Escola · Curso · Turma 12B", skipping what is unknown.
 *  A student who just enrolled has no school yet: the explicit institution link is set
 *  by an administrator, and until then the school comes from the class they enrolled in
 *  (kixi#100). Anything genuinely unknown is left out rather than faked. */
export function contextLine(me: Me | null): string {
  if (!me) return '';
  const parts: string[] = [];
  if (me.school) parts.push(me.school.name);
  if (me.course) parts.push(me.course.name);
  if (me.currentClass) parts.push(`Turma ${me.currentClass.code}`);
  return parts.join(' · ');
}

/** Only remote images are rendered; anything else falls back to the initials avatar. */
export function photoUrl(me: Me | null): string | null {
  const photo = me?.photo?.trim();
  if (!photo) return null;
  return /^https?:\/\/\S+$/i.test(photo) ? photo : null;
}
