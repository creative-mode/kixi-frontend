/** Regras do Explorar (#728): o selo com as iniciais da escola, e juntar professores e
 *  alunos numa só lista de "Pessoas". Puro para o `node --test` o alcançar. */

export interface SchoolBadge {
  initials: string;
  bg: string;
  fg: string;
}

/** As mesmas cores do protótipo, à borla pelo nome da escola — a mesma escola fica
 *  sempre com a mesma cor, como a inicial do `UserAvatar`. */
const PALETTE: Omit<SchoolBadge, 'initials'>[] = [
  { bg: '#121c15', fg: '#ffffff' },
  { bg: '#e7defc', fg: '#3a1d94' },
  { bg: '#fbf1d6', fg: '#4d3300' },
  { bg: '#e6eff8', fg: '#245f9e' },
  { bg: '#dbe9d3', fg: '#1b4d27' },
];

/** Até 3 letras: as iniciais de cada palavra com 3 ou mais letras ("Instituto Técnico
 *  Kianda" → "ITK"), ou as duas primeiras letras quando o nome não dá iniciais nenhumas
 *  ("CEFOPE" de uma só palavra curta → "CE"). */
export function schoolInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter((w) => w.length >= 3);
  const initials = words.map((w) => w[0]!.toUpperCase()).join('').slice(0, 3);
  if (initials.length >= 2) return initials;
  return name.trim().slice(0, 2).toUpperCase();
}

export function schoolBadge(name: string): SchoolBadge {
  const hash = [...name].reduce((a, c) => a + c.charCodeAt(0), 0);
  return { initials: schoolInitials(name), ...PALETTE[hash % PALETTE.length] };
}

export interface PersonResult {
  accountId: number;
  displayName: string;
  sub: string | null;
  photo?: string | null;
  verified?: boolean;
}

/** Professores e alunos numa só lista de "Pessoas" (o protótipo não os separa): os
 *  professores primeiro, porque pesquisar por um colega é mais comum do que ter um
 *  professor com o mesmo nome. */
export function mergePeople(
  teachers: Array<{ accountId: number | null; displayName: string; specialty?: string | null; photo?: string | null; verified?: boolean }>,
  students: Array<{ accountId: number; displayName: string; photo?: string | null }>,
): PersonResult[] {
  const fromTeachers = teachers
    .filter((t): t is typeof t & { accountId: number } => t.accountId != null)
    .map((t) => ({ accountId: t.accountId, displayName: t.displayName, sub: t.specialty ?? 'Professor', photo: t.photo, verified: t.verified }));
  const fromStudents = students.map((s) => ({ accountId: s.accountId, displayName: s.displayName, sub: 'Colega', photo: s.photo }));
  const seen = new Set<number>();
  return [...fromTeachers, ...fromStudents].filter((p) => (seen.has(p.accountId) ? false : (seen.add(p.accountId), true)));
}
