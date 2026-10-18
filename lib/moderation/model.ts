// Denúncia e moderação de perfis e de escolas (#323): o contrato do
// `ModerationController` e as regras do ecrã.
//
// O lado do aluno tem as mesmas decisões em `student/lib/moderation.ts`. Ficam
// separadas porque são apps diferentes com contratos diferentes; o que tem de bater
// certo entre as duas são os nomes das decisões, e isso está escrito nos testes dos dois
// lados — se um mudar sem o outro, um dos testes falha.

export type ReportTarget = 'ACCOUNT' | 'INSTITUTION';

export const REPORT_TARGETS: readonly ReportTarget[] = ['ACCOUNT', 'INSTITUTION'];

export const TARGET_LABEL: Record<ReportTarget, string> = {
  ACCOUNT: 'Pessoa',
  INSTITUTION: 'Escola',
};

/** Os mesmos motivos que o aluno vê, com o mesmo texto. */
export const REASONS = {
  IMPERSONATION: 'Impersonação — está a fazer-se passar por outra pessoa',
  FAKE_SCHOOL: 'Escola falsa — não existe ou foi criada para enganar',
  OFFENSIVE_NAME: 'Nome ofensivo ou impróprio',
  OFFENSIVE_PHOTO: 'Fotografia imprópria',
  MISLEADING_CONTENT: 'Conteúdo enganador',
  BLOCK: 'Bloquear esta pessoa',
  OTHER: 'Outro motivo',
} as const;

export type ReportReason = keyof typeof REASONS;

export const REASON_KEYS = Object.keys(REASONS) as ReportReason[];

export const REASON_LABEL = REASONS;

/** O que o moderador pode decidir. `IGNORED` não muda nada no alvo. */
export const DECISIONS = ['IGNORED', 'HIDDEN', 'SUSPENDED'] as const;
export type Decision = (typeof DECISIONS)[number];

export const DECISION_LABEL: Record<Decision, string> = {
  IGNORED: 'Ignorar',
  HIDDEN: 'Ocultar',
  SUSPENDED: 'Suspender',
};

export const DECISION_NOTE: Record<Decision, string> = {
  IGNORED: 'A denúncia não se confirma. Nada muda no perfil.',
  HIDDEN: 'O perfil deixa de ser visível para terceiros e passa a devolver 404.',
  SUSPENDED: 'Como ocultar, e a conta deixa de conseguir entrar.',
};

export type ReportStatus = 'OPEN' | 'IGNORED' | 'HIDDEN' | 'SUSPENDED';

export const STATUS_LABEL: Record<ReportStatus, string> = {
  OPEN: 'Por decidir',
  IGNORED: 'Ignorada',
  HIDDEN: 'Alvo ocultado',
  SUSPENDED: 'Alvo suspenso',
};

/** `ReportResponse` */
export interface Report {
  id: number;
  target: ReportTarget;
  targetId: number;
  targetName: string;
  reporterAccountId: number;
  reporterName: string;
  reason: ReportReason;
  note: string;
  status: ReportStatus;
  createdAt: string;
  decidedAt: string | null;
  decidedBy: string | null;
  decisionNote: string | null;
}

/** `AuditEntryResponse` — o registo de auditoria, critério de aceitação da issue. */
export interface AuditEntry {
  id: number;
  at: string;
  actor: string;
  action: string;
  target: ReportTarget;
  targetId: number;
  targetName: string;
  reportId: number;
  note: string;
}

export function isId(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

export function isReportStatus(value: unknown): value is ReportStatus {
  return typeof value === 'string' && (['OPEN', 'IGNORED', 'HIDDEN', 'SUSPENDED'] as readonly string[]).includes(value);
}

export function isDecision(value: unknown): value is Decision {
  return typeof value === 'string' && (DECISIONS as readonly string[]).includes(value);
}

export function isReportTarget(value: unknown): value is ReportTarget {
  return typeof value === 'string' && (REPORT_TARGETS as readonly string[]).includes(value);
}

export function isReportReason(value: unknown): value is ReportReason {
  return typeof value === 'string' && Object.hasOwn(REASONS, value);
}

/** Uma escola pode ocultar-se mas não suspender-se: não há sessão para suspender. */
export function decisionValida(target: ReportTarget, decision: unknown): decision is Decision {
  if (!isDecision(decision)) return false;
  if (target === 'INSTITUTION' && decision === 'SUSPENDED') return false;
  return true;
}

export function noteError(note: string, max = 500): string | null {
  const limpa = note.trim();
  if (limpa.length > max) return `A nota tem de ter no máximo ${max} caracteres.`;
  return null;
}

/** Quantas denúncias por motivo, para o topo da fila mostrar onde está a queixa. */
export function contarPorMotivo(reports: readonly Report[]): { reason: ReportReason; total: number }[] {
  const conta = new Map<ReportReason, number>();
  for (const r of reports) if (r.status === 'OPEN') conta.set(r.reason, (conta.get(r.reason) ?? 0) + 1);
  return [...conta.entries()]
    .map(([reason, total]) => ({ reason, total }))
    .sort((a, b) => b.total - a.total || a.reason.localeCompare(b.reason));
}

/** A mesma denúncia de duas pessoas conta uma vez no alvo, mas as pessoas não. */
export function porAlvo(reports: readonly Report[]): Map<string, Report[]> {
  const mapa = new Map<string, Report[]>();
  for (const r of reports) {
    const chave = `${r.target}:${r.targetId}`;
    const atual = mapa.get(chave);
    if (atual) atual.push(r);
    else mapa.set(chave, [r]);
  }
  return mapa;
}