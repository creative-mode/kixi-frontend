'use server';

import { getAuthHeaders } from '@/lib/auth.server';
import { API_BASE } from '@/lib/constants';
import { apiFetch } from '@/lib/mock/fetch';
import { TIMEOUT_MESSAGE, isTimeout, timeoutSignal, withDeadline } from '@/lib/timeout';
import type { Section } from '@/types/analytics';
import type { TermSheetDetail, TermSheetSummary } from '@/types/term-sheets';

const BASE = `${API_BASE}/term-sheets`;

/** O id da pauta entra no caminho do pedido: só aceita o formato que o motor gera (PT-...), nada que mude o caminho. */
const SHEET_ID = /^[A-Za-z0-9._-]{1,80}$/;

async function get<T>(path: string): Promise<T> {
  const headers = await getAuthHeaders();
  let res: Response;
  try {
    // As pautas mudam quando o motor as fecha: nunca de cache, e nunca à espera para sempre.
    res = await withDeadline(apiFetch(`${BASE}${path}`, { headers, cache: 'no-store', signal: timeoutSignal() }));
  } catch (err) {
    if (isTimeout(err)) throw new Error(TIMEOUT_MESSAGE);
    throw err;
  }
  if (!res.ok) {
    if (res.status === 401) throw new Error('Sessão expirada. Inicie sessão novamente.');
    if (res.status === 403) throw new Error('Sem permissão para ver esta pauta.');
    if (res.status === 404) throw new Error('Pauta não encontrada.');
    throw new Error(`Erro ${res.status} ao carregar as pautas.`);
  }
  return (await res.json()) as T;
}

async function section<T>(path: string): Promise<Section<T>> {
  try {
    return { ok: true, data: await get<T>(path) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Não foi possível carregar as pautas.' };
  }
}

/** As pautas que o utilizador pode ver: o backend decide (ADMIN todas, o professor as das suas turmas e disciplinas). */
export async function listTermSheets(): Promise<Section<TermSheetSummary[]>> {
  return section<TermSheetSummary[]>('');
}

/** Uma pauta com as linhas por aluno. */
export async function getTermSheet(sheetId: string): Promise<Section<TermSheetDetail>> {
  if (!SHEET_ID.test(sheetId)) return { ok: false, error: 'Pauta inválida.' };
  return section<TermSheetDetail>(`/${encodeURIComponent(sheetId)}`);
}
