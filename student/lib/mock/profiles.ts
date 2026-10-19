// As regras de perfil do mock (#336): quem vê o quê. Vive à parte do backend.ts para se testar.

export type Visibility = 'public' | 'school' | 'private';

export const VISIBILITIES: readonly Visibility[] = ['public', 'school', 'private'];

export const isVisibility = (value: unknown): value is Visibility =>
  typeof value === 'string' && (VISIBILITIES as readonly string[]).includes(value);

/** Com `private`, só o dono vê mais do que o nome e a foto. */
export function isRestricted(visibility: Visibility, viewerIsOwner: boolean): boolean {
  return !viewerIsOwner && visibility === 'private';
}

export interface PersonAttributes {
  kind: 'teacher' | 'student';
  level: number | null;
  xp: number | null;
  badges: string[];
  specialty: string | null;
}

/**
 * Os atributos de `/profiles/accounts/{id}` conforme o kind (#371): um professor nunca ganha XP
 * nem medalhas — é gamificação só do aluno — e mostra a especialidade em vez disso. `kind` vem
 * sempre em minúsculas, como o backend real devolve desde a #336 (nunca `'TEACHER'`/`'STUDENT'`).
 */
export function personAttributes(
  isTeacherRole: boolean,
  studentStats: { level: number; xp: number; badges: string[] },
  teacherSpecialty: string | null,
): PersonAttributes {
  return isTeacherRole
    ? { kind: 'teacher', level: null, xp: null, badges: [], specialty: teacherSpecialty }
    : { kind: 'student', level: studentStats.level, xp: studentStats.xp, badges: studentStats.badges, specialty: null };
}

/** A pesquisa só começa com 2 letras e procura no nome, código e sigla, sem maiúsculas. */
export function matchesSearch(q: string, school: { name: string; code: string; short_name: string | null }): boolean {
  const term = q.trim().toLowerCase();
  return term.length >= 2 && `${school.name} ${school.code} ${school.short_name ?? ''}`.toLowerCase().includes(term);
}
