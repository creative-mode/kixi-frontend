'use server';

// Denúncia e moderação de perfis e de escolas (#323), sobre o `ModerationController`.
//
// Só o ADMIN decide, como na verificação de escolas: uma action é um endpoint, e o
// guard aqui evita gastares um pedido para ouvir «Forbidden».
//
// O registo de auditoria é critério de aceitação da issue. Por isso `decideReport`
// não tem um caminho em que a decisão se guarde sem escrever nele: a nota e o
// histórico andam sempre juntos.

import { revalidatePath } from 'next/cache';

import { getCurrentUser } from '@/lib/auth.server';
import { call, fail, guard, ok, type Result } from '@/lib/crud/http';
import { MODERATION_UNAVAILABLE, moderationAvailable, moderationRefusal } from '@/lib/moderation/availability';
import { auditPath, decisionPath, reportsPath } from '@/lib/moderation/contract';
import {
  decisionValida,
  isId,
  isReportStatus,
  notaDecisaoError,
  type AuditEntry,
  type Decision,
  type Report,
  type ReportStatus,
} from '@/lib/moderation/model';

async function admin(): Promise<Result<undefined>> {
  const user = await getCurrentUser();
  if (!user) return fail('Sessão expirada. Inicie sessão novamente.');
  if (!user.roles.includes('ADMIN')) return fail('Só o administrador gere a moderação.');
  return ok(undefined);
}

/**
 * Sem a moderação no servidor (#749) não se gasta um pedido para ouvir 403, e um 403 vindo de
 * uma rota só de ADMIN depois de o guard ter passado é uma rota fechada, não um papel em falta.
 */
async function refused(res: Response): Promise<Result<never>> {
  return fail(moderationRefusal(res.status, await res.text().catch(() => '')));
}

/** O `isId`/`isReportStatus` ficam aqui para o ecrã poder validar sem importar o backend. */
export { decisionValida, notaDecisaoError };

export async function listReports(status: ReportStatus | null): Promise<Result<Report[]>> {
  return guard(async () => {
    const allowed = await admin();
    if (!allowed.ok) return allowed;
    if (!moderationAvailable()) return fail(MODERATION_UNAVAILABLE);
    if (status !== null && !isReportStatus(status)) return fail('Estado inválido.');
    const res = await call(reportsPath(status));
    if (!res.ok) return refused(res);
    return ok((await res.json()) as Report[]);
  });
}

/** O registo de auditoria: quem decidiu o quê, quando e porquê. */
export async function listAudit(): Promise<Result<AuditEntry[]>> {
  return guard(async () => {
    const allowed = await admin();
    if (!allowed.ok) return allowed;
    if (!moderationAvailable()) return fail(MODERATION_UNAVAILABLE);
    const res = await call(auditPath());
    if (!res.ok) return refused(res);
    return ok((await res.json()) as AuditEntry[]);
  });
}

export async function decideReport(
  reportId: number,
  decision: Decision,
  target: Report['target'],
  note: string,
): Promise<Result<Report>> {
  return guard(async () => {
    const allowed = await admin();
    if (!allowed.ok) return allowed;
    if (!moderationAvailable()) return fail(MODERATION_UNAVAILABLE);
    if (!isId(reportId)) return fail('Denúncia inválida.');
    // A validação do par decisão/alvo é a mesma que a do ecrã: o botão já não
    // oferece «suspender» a uma escola, mas uma action é um endpoint e repete-se.
    if (!decisionValida(target, decision)) {
      return fail(
        target === 'INSTITUTION' && decision === 'SUSPENDED'
          ? 'Uma escola pode ser ocultada, não suspensa.'
          : 'Decisão inválida.',
      );
    }
    const erroNota = notaDecisaoError(decision, note);
    if (erroNota) return fail(erroNota);

    const caminho = decisionPath(reportId, decision);
    const res = await call(caminho, { method: 'POST', body: JSON.stringify({ note: note.trim() }) });
    if (!res.ok) return refused(res);
    revalidatePath('/moderacao');
    revalidatePath('/moderacao/auditoria');
    return ok((await res.json()) as Report);
  });
}