import 'server-only';

import { apiGet, type Result } from './api';
import { parseMyTermSheets, type MyTermSheet } from './pautas-rules';

export type { MyTermSheet } from './pautas-rules';

/** As pautas do próprio aluno: o backend devolve só a sua linha, só de pautas fechadas (kixi#506). */
export async function getMyTermSheets(): Promise<Result<MyTermSheet[]>> {
  const result = await apiGet<unknown>('/me/term-sheets');
  if (!result.ok) return result;
  try {
    return { ...result, data: parseMyTermSheets(result.data) };
  } catch {
    return { ok: false, status: 502, message: 'Não foi possível ler as pautas. Tenta mais tarde.' };
  }
}
