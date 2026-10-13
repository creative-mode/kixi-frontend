import 'server-only';

import { cookies } from 'next/headers';
import { BACKEND, COOKIE } from './session';
import { MOCK, mockHandle } from './mock/backend';

/** The browser cannot call the backend itself: the token lives in an httpOnly cookie
 *  that only the server reads. So the tutor goes through two route handlers that add
 *  the bearer and hand the response back as it is — including the body of the
 *  event stream, which is passed through and not buffered, or the answer would arrive
 *  all at once at the end.
 *
 *  What the client sees on failure is the backend's own status (404, 429, 503, ...) and
 *  the `Retry-After` header, because the screen's wording depends on them. */
export async function forwardToTutor(
  path: string,
  body: unknown,
  signal: AbortSignal,
): Promise<Response> {
  const token = (await cookies()).get(COOKIE)?.value ?? null;
  if (!token) return Response.json({ message: 'A sessão expirou. Entra novamente.' }, { status: 401 });

  const payload = JSON.stringify(body ?? {});
  let upstream: Response;
  try {
    upstream = MOCK
      ? await mockHandle('POST', path, token, payload)
      : await fetch(`${BACKEND}${path}`, {
          method: 'POST',
          headers: {
            Accept: 'text/event-stream, application/json',
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: payload,
          cache: 'no-store',
          // The client's own abort (the student pressed "Parar", or left) ends the
          // upstream request too. There is deliberately no timeout here: a long
          // answer is a long stream, and the backend has its own idle timeout (504).
          signal,
        });
  } catch {
    return Response.json({ message: 'Não foi possível contactar o servidor.' }, { status: 502 });
  }

  const headers = new Headers();
  const type = upstream.headers.get('content-type');
  if (type) headers.set('Content-Type', type.includes('event-stream') ? 'text/event-stream' : 'application/json');
  const retry = upstream.headers.get('retry-after');
  if (retry) headers.set('Retry-After', retry);
  // Tells proxies in front (the gateway) not to hold the stream back.
  if (type?.includes('event-stream')) {
    headers.set('Cache-Control', 'no-cache, no-transform');
    headers.set('X-Accel-Buffering', 'no');
  }

  if (upstream.ok) return new Response(upstream.body, { status: upstream.status, headers });

  // A refusal before the first byte: the backend's problem detail is English and not
  // for the student, so only the status and the retry hint go on.
  headers.set('Content-Type', 'application/json');
  return new Response(JSON.stringify({ status: upstream.status }), { status: upstream.status, headers });
}
