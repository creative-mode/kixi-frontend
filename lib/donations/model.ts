// Doações de enunciados (#177): os contratos do `DonationController` e as regras que o ecrã usa.

export type DonationStatus = 'pending' | 'approved' | 'rejected' | 'converted';

export const DONATION_STATUSES: readonly DonationStatus[] = ['pending', 'approved', 'rejected', 'converted'];

export const STATUS_LABEL: Record<DonationStatus, string> = {
  pending: 'Por rever',
  approved: 'Aprovada',
  rejected: 'Rejeitada',
  converted: 'Convertida em prova',
};

/** `DonationSummary` */
export interface DonationSummary {
  id: number;
  reference: string;
  status: DonationStatus;
  institutionName: string;
  subjectName: string;
  examType: string;
  classGrade: string | null;
  schoolYear: string | null;
  fileCount: number;
  createdAt: string;
}

export interface DonationFile {
  id: number;
  originalName: string;
  contentType: string;
  sizeBytes: number;
}

/** `DonationDetail` */
export interface DonationDetail extends Omit<DonationSummary, 'fileCount'> {
  donorName: string | null;
  donorEmail: string | null;
  notes: string | null;
  consentAt: string | null;
  consentVersion: string | null;
  reviewNote: string | null;
  reviewedAt: string | null;
  statementId: number | null;
  files: DonationFile[];
}

/** `DonationPage` */
export interface DonationPage {
  items: DonationSummary[];
  total: number;
  page: number;
  limit: number;
  counts: Record<DonationStatus, number>;
}

export const PAGE_SIZE = 20;

export function isDonationStatus(value: unknown): value is DonationStatus {
  return typeof value === 'string' && (DONATION_STATUSES as readonly string[]).includes(value);
}

/** Um identificador que se pode pôr num caminho do backend. */
export function isId(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

/** Aprovar ou rejeitar só faz sentido até a doação virar prova. */
export function canReview(status: DonationStatus): boolean {
  return status !== 'converted';
}

/** Abrir no construtor: uma doação rejeitada não vira prova e uma convertida já virou. */
export function canOpenInBuilder(status: DonationStatus): boolean {
  return status === 'pending' || status === 'approved';
}

export function pageCount(total: number, limit = PAGE_SIZE): number {
  return Math.max(1, Math.ceil(total / limit));
}

export function isImage(contentType: string): boolean {
  return contentType.startsWith('image/');
}

export function fileSize(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** Só aceita `?donation=` com dígitos: o valor vai parar a um caminho do backend. */
export function donationParam(value: string | string[] | undefined): number | null {
  if (typeof value !== 'string' || !/^\d{1,12}$/.test(value)) return null;
  const id = Number(value);
  return isId(id) ? id : null;
}
