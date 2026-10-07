import 'server-only';

import { cookies } from 'next/headers';
import { BACKEND, COOKIE } from './session';
import { MOCK, mockHandle } from './mock/backend';
import type { Problem } from './types';

/** Same shape as lib/crud/http.ts in the manager: no exceptions for expected
 *  failures, so a Server Component can degrade instead of blowing up. */
export type Result<T> = { ok: true; data: T } | { ok: false; status: number; message: string };

const TIMEOUT = 10000;

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

/** Turns an error response into a sentence for the student.
 *  The security layer answers 401/403 with an empty body, so the status has to be
 *  readable on its own; validation errors carry a per-field `properties` map whose
 *  values are either a string or `{ message }`, and we drop the request metadata. */
export async function problem(res: Response): Promise<{ status: number; message: string }> {
  const body = (await res.json().catch(() => null)) as Problem | null;

  const fields =
    body?.properties && typeof body.properties === 'object'
      ? Object.entries(body.properties)
          .filter(([key]) => key !== 'instance' && key !== 'requestId')
          .map(([, value]) =>
            typeof value === 'string' ? value : (value as { message?: string } | null)?.message,
          )
          .filter((message): message is string => typeof message === 'string' && message.length > 0)
      : [];

  const detail = [body?.detail, ...fields].filter(Boolean).join(' · ') || body?.title;
  if (detail) return { status: res.status, message: detail };

  if (res.status === 401) return { status: 401, message: 'A sessão expirou. Entra novamente.' };
  if (res.status === 403) return { status: 403, message: 'Não tens permissão para fazer isto.' };
  return { status: res.status, message: `Erro ${res.status}` };
}

async function request<T>(method: string, path: string, body?: object): Promise<Result<T>> {
  const token = (await cookies()).get(COOKIE)?.value ?? null;
  const payload = body === undefined ? '' : JSON.stringify(body);

  try {
    const res = MOCK
      ? await mockHandle(method, path, token, payload)
      : await fetch(`${BACKEND}${path}`, {
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

export const apiGet = <T>(path: string) => request<T>('GET', path);
export const apiPost = <T>(path: string, body: object) => request<T>('POST', path, body);
export const apiPut = <T>(path: string, body: object) => request<T>('PUT', path, body);
