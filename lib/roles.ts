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

/**
 * As rotas do gestor que um professor (sem ADMIN) pode abrir. O resto manda-o para o
 * exam-builder. Os enunciados entram porque a #22 é o professor a fotografar, rever e
 * publicar a sua prova; a escrita continua limitada no backend às turmas e disciplinas
 * que ele dá. A lixeira fica de fora: restaurar e apagar de vez é gestão.
 */
export function teacherMayOpen(pathname: string): boolean {
  return (
    pathname === '/exam-builder' ||
    pathname.startsWith('/exam-builder/') ||
    pathname === '/statements' ||
    pathname === '/statements/import' ||
    /^\/statements\/\d+$/.test(pathname)
  );
}
