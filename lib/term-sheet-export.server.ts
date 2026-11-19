import 'server-only';
import { call } from '@/lib/crud/http';
import { isTimeout, TIMEOUT_MESSAGE } from '@/lib/timeout';
import { isUnavailableStatus, parseDetail, SHEET_ID, SHEET_UNAVAILABLE } from '@/lib/term-sheets';
import { exportErrorMessage, NO_PLAN, planForSheet } from '@/lib/term-sheet-export';
import type { TermPlan } from '@/types/term-plans';
import type { TermSheetDetail } from '@/types/term-sheets';

/**
 * A pauta e o plano do trimestre que a exporta (kixi-frontend#808). O backend só exporta por plano (kixi#622) e o ecrã só
 * conhece a pauta: lê-se a pauta (o backend confirma que o utilizador a pode ver) e procura-se o plano da mesma turma e
 * disciplina. Tudo corre no servidor do gestor: o browser nunca vê o motor, a ligação nem o token.
 */
export type Resolved = { ok: true; sheet: TermSheetDetail; plan: TermPlan } | { ok: false; status: number; error: string };

const failure = (status: number, error: string): Resolved => ({ ok: false, status, error });

export async function resolveSheetPlan(sheetId: string): Promise<Resolved> {
  if (!SHEET_ID.test(sheetId)) return failure(400, 'Pauta inválida.');
  try {
    const sheetRes = await call(`/api/v1/term-sheets/${encodeURIComponent(sheetId)}`);
    if (!sheetRes.ok) {
      if (sheetRes.status === 401) return failure(401, exportErrorMessage(401));
      return failure(sheetRes.status, isUnavailableStatus(sheetRes.status) ? SHEET_UNAVAILABLE : `Erro ${sheetRes.status} ao ler a pauta.`);
    }
    const sheet = parseDetail(await sheetRes.json());

    const query = new URLSearchParams({ classId: String(sheet.classId), subjectId: String(sheet.subjectId) });
    const plansRes = await call(`/api/v1/term-plans?${query}`);
    if (!plansRes.ok) return failure(plansRes.status, exportErrorMessage(plansRes.status));
    const plans = (await plansRes.json()) as TermPlan[];
    const plan = Array.isArray(plans) ? planForSheet(sheet, plans) : null;
    return plan ? { ok: true, sheet, plan } : failure(409, NO_PLAN);
  } catch (err) {
    if (isTimeout(err)) return failure(504, TIMEOUT_MESSAGE);
    return failure(502, 'Não foi possível contactar o servidor. Tente novamente.');
  }
}
