// O contrato HTTP da moderação com o backend (kixi#591, PR kixi#604): os caminhos e as chaves
// de cada resposta num só sítio, para as actions os usarem e o teste de contrato os comparar
// com o que o `ModerationAdminController` expõe.

import type { Decision, ReportStatus } from './model.ts';

/** O máximo que o backend devolve por pedido; sem `limit` devolvia só 100. */
export const LISTA_LIMITE = 500;

/** O backend corta em {@link LISTA_LIMITE}: uma lista desse tamanho pode estar incompleta. */
export function listaTruncada(total: number): boolean {
  return total >= LISTA_LIMITE;
}

/** O aviso que o ecrã mostra quando a lista pode estar cortada, e que diz o que fazer. */
export const AVISO_LISTA_TRUNCADA =
  `Mostram-se só os ${LISTA_LIMITE} registos mais recentes; pode haver mais antigos que ainda não se veem aqui.`;

export const REPORTS_PATH = '/api/v1/moderation/reports';
export const AUDIT_PATH = '/api/v1/moderation/audit';

/** `GET /reports?status=&limit=`: a fila, com o estado opcional. */
export function reportsPath(status: ReportStatus | null): string {
  const query = new URLSearchParams();
  if (status) query.set('status', status);
  query.set('limit', String(LISTA_LIMITE));
  return `${REPORTS_PATH}?${query}`;
}

/** `GET /audit?limit=`: o registo de auditoria, do mais recente para o mais antigo. */
export function auditPath(): string {
  return `${AUDIT_PATH}?limit=${LISTA_LIMITE}`;
}

/** `POST /reports/{id}/(ignore|hide|suspend)` com `{ note }`: não há um `/decision` único. */
export function decisionPath(reportId: number, decision: Decision): string {
  const verbo = decision === 'IGNORED' ? 'ignore' : decision === 'HIDDEN' ? 'hide' : 'suspend';
  return `${REPORTS_PATH}/${reportId}/${verbo}`;
}

/** As chaves de `ModerationReportResponse` no backend, pela ordem do record. */
export const REPORT_KEYS = [
  'id', 'target', 'targetId', 'targetName', 'reporterAccountId', 'reporterName', 'reason', 'note',
  'status', 'createdAt', 'decidedAt', 'decidedBy', 'decisionNote',
] as const;

/** As chaves de `AuditEntryResponse` no backend, pela ordem do record. */
export const AUDIT_KEYS = ['id', 'at', 'actor', 'action', 'target', 'targetId', 'targetName', 'reportId', 'note'] as const;
