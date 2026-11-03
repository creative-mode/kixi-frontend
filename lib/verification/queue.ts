/** Os filtros da fila de verificação, as contagens e a filtragem: sem React, testável com `node --test`. */
import { STATUS_LABEL, type VerificationRequest, type VerificationStatus } from './model.ts';

export type VerificationFilter = 'todos' | 'por-rever' | 'aprovado' | 'recusado' | 'revogado';

/** Pela ordem dos separadores. */
export const VERIFICATION_FILTERS: { key: VerificationFilter; label: string; status: VerificationStatus | null }[] = [
  { key: 'todos', label: 'Todos', status: null },
  { key: 'por-rever', label: STATUS_LABEL.PENDING, status: 'PENDING' },
  { key: 'aprovado', label: STATUS_LABEL.APPROVED, status: 'APPROVED' },
  { key: 'recusado', label: STATUS_LABEL.REJECTED, status: 'REJECTED' },
  { key: 'revogado', label: STATUS_LABEL.REVOKED, status: 'REVOKED' },
];

export const VERIFICATION_FILTER_KEYS = VERIFICATION_FILTERS.map((f) => f.key);

/** O que há para fazer primeiro: abre-se nos pedidos por rever. */
export const DEFAULT_VERIFICATION_FILTER: VerificationFilter = 'por-rever';

const statusOf = (filter: VerificationFilter) => VERIFICATION_FILTERS.find((f) => f.key === filter)?.status ?? null;

export function filterRequests(items: readonly VerificationRequest[], filter: VerificationFilter): VerificationRequest[] {
  const status = statusOf(filter);
  return status === null ? [...items] : items.filter((r) => r.status === status);
}

export function verificationCounts(items: readonly Pick<VerificationRequest, 'status'>[]): Record<VerificationFilter, number> {
  const count = (status: VerificationStatus) => items.filter((r) => r.status === status).length;
  return {
    todos: items.length,
    'por-rever': count('PENDING'),
    aprovado: count('APPROVED'),
    recusado: count('REJECTED'),
    revogado: count('REVOKED'),
  };
}
