// Verificação de escolas (#322): o contrato do `InstitutionVerificationController` e as regras do ecrã.

export type VerificationStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'REVOKED';

export const VERIFICATION_STATUSES: readonly VerificationStatus[] = ['PENDING', 'APPROVED', 'REJECTED', 'REVOKED'];

export const STATUS_LABEL: Record<VerificationStatus, string> = {
  PENDING: 'Por rever',
  APPROVED: 'Aprovado',
  REJECTED: 'Recusado',
  REVOKED: 'Revogado',
};

/** `VerificationRequestResponse` */
export interface VerificationRequest {
  id: number;
  institutionId: number;
  officialName: string;
  registrationNumber: string;
  contactEmail: string;
  documentUrl: string | null;
  notes: string | null;
  status: VerificationStatus;
  reviewNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

export const MAX_NOTE = 500;

export const isId = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value > 0;

export const isStatus = (value: unknown): value is VerificationStatus =>
  typeof value === 'string' && (VERIFICATION_STATUSES as readonly string[]).includes(value);

/** Só um pedido por rever se aprova ou recusa; só um aprovado se revoga. */
export const canReview = (status: VerificationStatus) => status === 'PENDING';
export const canRevoke = (status: VerificationStatus) => status === 'APPROVED';

/** Recusar exige o motivo, que a escola vê; aprovar aceita uma nota opcional. */
export function noteError(decision: 'approve' | 'reject', note: string): string | null {
  const trimmed = note.trim();
  if (decision === 'reject' && !trimmed) return 'Diga o motivo da recusa: a escola vai vê-lo.';
  if (trimmed.length > MAX_NOTE) return `A nota tem no máximo ${MAX_NOTE} caracteres.`;
  return null;
}

/** Só endereços http(s) viram ligação: o documento vem de quem pediu a verificação. */
export const safeDocumentUrl = (url: string | null): string | null => {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.href : null;
  } catch {
    return null;
  }
};
