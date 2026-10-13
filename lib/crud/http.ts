import 'server-only';
import { getAuthHeaders } from '@/lib/auth.server';
import { API_HOST } from '@/lib/constants';
import { apiFetch } from '@/lib/mock/fetch';

/** Result of a server action: never throws across the boundary, so the UI can show the message. */
export type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string };
export const ok = <T,>(data: T): Result<T> => ({ ok: true, data });
export const fail = (error: string): Result<never> => ({ ok: false, error });

export async function message(res: Response): Promise<string> {
  if (res.status === 401) return 'Sessão expirada. Inicie sessão novamente.';
  if (res.status === 403) return 'Não tem permissão para esta operação.';
  if (res.status === 404) return 'Registo não encontrado.';
  const body = await res.text().catch(() => '');
  try {
    const j = JSON.parse(body);
    const props = j.properties && typeof j.properties === 'object' ? Object.values(j.properties).filter((v) => typeof v === 'string') : [];
    return [j.detail, ...props].filter(Boolean).join(' · ') || j.title || `Erro ${res.status}`;
  } catch {
    return body || `Erro ${res.status}`;
  }
}

/** Authenticated call to the backend. Multipart bodies must not get a JSON content type: fetch sets the boundary itself. */
export async function call(path: string, init: RequestInit = {}): Promise<Response> {
  const headers: Record<string, string> = { ...(await getAuthHeaders()) };
  if (init.body instanceof FormData) delete headers['Content-Type'];
  return apiFetch(`${API_HOST}${path}`, { ...init, headers: { ...headers, ...((init.headers as Record<string, string>) ?? {}) }, cache: 'no-store' });
}

export async function guard<T>(fn: () => Promise<Result<T>>): Promise<Result<T>> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof DOMException && e.name === 'TimeoutError') {
      return fail('O processamento demorou demasiado tempo. Tente com menos ficheiros ou ficheiros mais leves.');
    }
    const msg = String((e as Error)?.message ?? '');
    return fail(msg.includes('Não autenticado') ? 'Sessão expirada. Inicie sessão novamente.' : msg || 'Não foi possível contactar o servidor.');
  }
}
