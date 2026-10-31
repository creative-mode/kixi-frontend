// ⚠️ Espelho de student/lib/roles.ts (apps Next separadas, sem import partilhado).
// Se alterares a regra de papéis aqui, altera lá também.
export const ROLES = ['ADMIN', 'TEACHER', 'STUDENT'] as const;

export type Role = (typeof ROLES)[number];

export function normalizeRoles(value: unknown): Role[] {
  if (!Array.isArray(value)) return [];
  return value.filter((role): role is Role => typeof role === 'string' && ROLES.includes(role as Role));
}

export function hasRole(roles: readonly Role[], role: Role): boolean {
  return roles.includes(role);
}

export function canAccessManager(roles: readonly Role[]): boolean {
  return hasRole(roles, 'ADMIN') || hasRole(roles, 'TEACHER');
}

export function isStudentOnly(roles: readonly Role[]): boolean {
  return roles.length === 1 && hasRole(roles, 'STUDENT');
}

// ── só do gestor (não tem espelho no aluno) ─────────────────────────────────

/** Rotas de administração: um professor que lá chegue vê a 403 com o motivo. */
const ADMIN_ONLY_ROUTES = [
  '/school-year',
  '/terms',
  '/subjects',
  '/courses',
  '/institutions',
  '/teachers',
  '/teaching-assignments',
  '/enrollments',
  '/roles',
  '/accounts',
  '/users',
  '/sessions',
  '/donations',
  '/verification',
];

const isUnder = (pathname: string, route: string) => pathname === route || pathname.startsWith(`${route}/`);

/**
 * As rotas do gestor que um professor (sem ADMIN) pode abrir.
 *
 * As listas abrem-se sem subrotas: `/classes/new`, as edições e as lixeiras são
 * gestão, e sem esta distinção o professor abria o formulário e só descobria o
 * bloqueio ao gravar. Os enunciados abrem também o import e a revisão de um
 * enunciado, porque a #22 é o professor a fotografar, rever e publicar a sua
 * prova; a escrita continua limitada no backend às turmas e disciplinas que ele dá.
 */
export function teacherMayOpen(pathname: string): boolean {
  return (
    pathname === '/professor' ||
    pathname === '/professor/tutor' ||
    pathname === '/desempenho' ||
    isUnder(pathname, '/exam-builder') ||
    pathname === '/exam-rooms' ||
    pathname === '/exam-rooms/new' ||
    /^\/exam-rooms\/\d+$/.test(pathname) ||
    pathname === '/statements' ||
    pathname === '/statements/import' ||
    /^\/statements\/\d+$/.test(pathname) ||
    pathname === '/simulations' ||
    pathname === '/simulation-answers' ||
    pathname === '/classes' ||
    pathname === '/tarefas' ||
    pathname === '/pautas' ||
    /^\/tarefas\/\d+$/.test(pathname)
  );
}

/** O que fazer com um professor (sem ADMIN) que pede `pathname` no gestor. */
export function teacherRoute(pathname: string): 'allow' | 'forbidden' | 'home' {
  if (ADMIN_ONLY_ROUTES.some((route) => isUnder(pathname, route))) return 'forbidden';
  return teacherMayOpen(pathname) ? 'allow' : 'home';
}

/** Estrutura académica: só o ADMIN a altera (o backend responde 403 ao professor), por isso o gestor não lhe mostra botões de escrita. */
const STRUCTURE_ENTITIES = ['school-years', 'terms', 'subjects', 'courses', 'classes', 'institutions', 'teaching-assignments'];
export const isStructureEntity = (key: string) => STRUCTURE_ENTITIES.includes(key);
