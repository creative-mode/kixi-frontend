// ⚠️ Espelho em landing/lib/forbidden/reasons.ts e student/lib/forbidden/reasons.ts
// (apps Next separadas, sem import partilhado). Se alterares aqui, altera lá também.
export const FORBIDDEN_REASONS = ['role', 'student-manager', 'manager'] as const;

export type ForbiddenReason = (typeof FORBIDDEN_REASONS)[number];

export function isForbiddenReason(value: unknown): value is ForbiddenReason {
  return typeof value === 'string' && (FORBIDDEN_REASONS as readonly string[]).includes(value);
}

export function normalizeForbiddenReason(value: string | string[] | undefined): ForbiddenReason | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  return isForbiddenReason(raw) ? raw : undefined;
}
