import 'server-only';
import { getAuthHeaders } from '@/lib/auth.server';
import { API_HOST } from '@/lib/constants';
import { apiFetch } from '@/lib/mock/fetch';
import { TIMEOUT_MESSAGE, isTimeout, timeoutSignal, withDeadline } from '@/lib/timeout';
import { friendlyMessage } from './messages';

/** Result of a server action: never throws across the boundary, so the UI can show the message. */
export type ActionErrorCode = 'SESSION_EXPIRED';
export type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string; code?: ActionErrorCode };
export const ok = <T,>(data: T): Result<T> => ({ ok: true, data });
export const fail = (error: string, code?: ActionErrorCode): Result<never> => ({ ok: false, error, ...(code ? { code } : {}) });

export async function message(res: Response): Promise<string> {
  return friendlyMessage(res.status, await res.text().catch(() => ''));
}

/** Authenticated call to the backend. Multipart bodies must not get a JSON content type: fetch sets the boundary itself.
 *
 * Sem `signal` do chamador, o pedido leva o prazo por omissão e o `withDeadline`
 * garante que termina mesmo que o transporte ignore o sinal (#191). Um chamador
 * que traga o seu próprio prazo (o OCR usa 3 min) fica com ele — não o cortamos. */
export async function call(path: string, init: RequestInit = {}): Promise<Response> {
  const headers: Record<string, string> = { ...(await getAuthHeaders()) };
  if (init.body instanceof FormData) delete headers['Content-Type'];
  const request = apiFetch(`${API_HOST}${path}`, {
    ...init,
    headers: { ...headers, ...((init.headers as Record<string, string>) ?? {}) },
    cache: 'no-store',
    ...(init.signal ? {} : { signal: timeoutSignal() }),
  });
  return init.signal ? request : withDeadline(request);
}

export async function guard<T>(fn: () => Promise<Result<T>>): Promise<Result<T>> {
  try {
    return await fn();
  } catch (e) {
    if (isTimeout(e)) {
      return fail(TIMEOUT_MESSAGE);
    }
    const msg = String((e as Error)?.message ?? '');
    return fail(msg.includes('Não autenticado') ? 'Sessão expirada. Inicie sessão novamente.' : msg || 'Não foi possível contactar o servidor.');
  }
}
