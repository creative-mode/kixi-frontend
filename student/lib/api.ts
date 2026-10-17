import 'server-only';

import { cookies } from 'next/headers';
import { BACKEND, COOKIE } from './session';
import { MOCK, mockHandle } from './mock/backend';
import { friendlyMessage } from './error-messages';

/** Same shape as lib/crud/http.ts in the manager: no exceptions for expected
 *  failures, so a Server Component can degrade instead of blowing up. */
export type Result<T> = { ok: true; data: T } | { ok: false; status: number; message: string };

const TIMEOUT = 10000;

/** Query parameters for a read. Undefined values are dropped, so a caller can pass a
 *  filter it does not have without building the string by hand. */
export type Query = Record<string, string | number | undefined>;

/** Headers for authenticated calls. The session cookie is the only credential here:
 *  the token never reaches the browser, and the backend stays authoritative on
 *  what each role may read or write. */
export async function authHeaders(): Promise<Record<string, string>> {
  const token = (await cookies()).get(COOKIE)?.value;
  return {
    Accept: 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

/** Turns an error response into a sentence in Portuguese for the student.
 *  The server's `detail` is in English: known texts have their own translation and the rest
 *  falls back to a sentence per status (lib/error-messages.ts). The security layer answers 401/403 with an
 *  empty body, so the status has to be readable on its own anyway. */
export async function problem(res: Response): Promise<{ status: number; message: string }> {
  const body = (await res.json().catch(() => null)) as { detail?: unknown; title?: unknown } | null;
  const serverText = [body?.detail, body?.title].find((v): v is string => typeof v === 'string') ?? '';
  return { status: res.status, message: friendlyMessage(res.status, serverText) };
}

async function request<T>(
  method: string,
  path: string,
  body?: object,
  query?: Query,
): Promise<Result<T>> {
  const token = (await cookies()).get(COOKIE)?.value ?? null;
  const payload = body === undefined ? '' : JSON.stringify(body);
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined) search.set(key, String(value));
  }
  const suffix = search.size > 0 ? `?${search.toString()}` : '';

  try {
    const res = MOCK
      ? await mockHandle(method, `${path}${suffix}`, token, payload)
      : await fetch(`${BACKEND}${path}${suffix}`, {
          method,
          headers: {
            Accept: 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
          },
          body: body === undefined ? undefined : payload,
          cache: 'no-store',
          signal: AbortSignal.timeout(TIMEOUT),
        });

    if (!res.ok) return { ok: false, ...(await problem(res)) };
    if (res.status === 204) return { ok: true, data: undefined as T };
    return { ok: true, data: (await res.json()) as T };
  } catch (error: unknown) {
    const timedOut = error instanceof Error && error.name === 'TimeoutError';
    return {
      ok: false,
      status: 0,
      message: timedOut
        ? 'O servidor demorou a responder. Tenta de novo.'
        : 'Não foi possível contactar o servidor.',
    };
  }
}

export const apiGet = <T>(path: string, query?: Query) => request<T>('GET', path, undefined, query);
export const apiPost = <T>(path: string, body: object) => request<T>('POST', path, body);
export const apiPut = <T>(path: string, body: object) => request<T>('PUT', path, body);
export const apiDelete = <T>(path: string) => request<T>('DELETE', path);
