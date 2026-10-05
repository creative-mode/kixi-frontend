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
