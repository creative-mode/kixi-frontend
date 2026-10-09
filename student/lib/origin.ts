/**
 * Espelho de lib/origin.ts na raiz (apps Next separadas, sem import partilhado).
 * Se alterares a regra de origens aqui, altera lá também.
 *
 * Public origin of the deployment, for the redirects that cross app boundaries.
 *
 * The origin the browser sees is not the one Next receives: behind the gateway
 * (scripts/gateway.mjs) each app gets an internal host and the public address arrives
 * in `x-forwarded-host`. That header — like `Host` — is chosen by whoever made the
 * request, so a redirect assembled from it is an open redirect. Hence the origin is
 * configuration, and the request is only believed outside production, which keeps
 * `npm run dev` working with no environment set.
 */

/** The gateway root, where the landing and the canonical /403 live. */
export function appOrigin(): string | null {
  return origin(process.env.APP_ORIGIN);
}

function origin(value: string | undefined): string | null {
  const raw = value?.trim();
  if (!raw) return null;
  try {
    return new URL(raw).origin;
  } catch {
    return null;
  }
}

/** Where ADMIN and TEACHER accounts belong: the manager app, on the same cookie. */
export function managerUrl(): string | null {
  const explicit = process.env.NEXT_PUBLIC_MANAGER_URL?.trim();
  if (explicit) {
    try {
      return new URL(explicit).toString();
    } catch {
      /* falls through to the gateway */
    }
  }
  const base = appOrigin();
  return base ? `${base}/manager` : null;
}

/** Last resort, development only: believe the request. Never call this in
 *  production — `resolveOrigin` already refuses to. */
export function originFromRequest(headers: Headers, fallbackProtocol: string): string | null {
  const host = headers.get('x-forwarded-host') ?? headers.get('host');
  if (!host) return null;
  const proto = headers.get('x-forwarded-proto') ?? fallbackProtocol.replace(':', '');
  try {
    return new URL(`${proto}://${host}`).origin;
  } catch {
    return null;
  }
}

/** The origin to build redirects from, or null when nothing is configured.
 *  In production this is configuration only: without `APP_ORIGIN` (or
 *  `NEXT_PUBLIC_MANAGER_URL` for the manager address) there is no redirect
 *  target, and callers must degrade to a same-origin relative redirect —
 *  never to the request headers, which the attacker chooses. */
export function resolveOrigin(headers: Headers, fallbackProtocol: string): string | null {
  const configured = appOrigin();
  if (configured) return configured;
  if (process.env.NODE_ENV === 'production') return null;
  return originFromRequest(headers, fallbackProtocol);
}
