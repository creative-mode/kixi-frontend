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

/**
 * Last resort, outside production only: believe the request.
 *
 * In production this returns null whatever the request says. `x-forwarded-host` and `Host`
 * are chosen by whoever made the request, so a redirect built from either is an open
 * redirect. The guard is here as well as in `resolveOrigin`: this function is exported, and
 * an export that is only correct by convention is one a future import breaks silently.
 */
export function originFromRequest(headers: Headers, fallbackProtocol: string): string | null {
  if (process.env.NODE_ENV === 'production') return null;
  const host = headers.get('x-forwarded-host') ?? headers.get('host');
  if (!host) return null;
  const proto = headers.get('x-forwarded-proto') ?? fallbackProtocol.replace(':', '');
  try {
    return new URL(`${proto}://${host}`).origin;
  } catch {
    return null;
  }
}

/**
 * The origin to build redirects from, or null when nothing is configured.
 *
 * In production this is configuration or nothing. Degrading to a same-origin redirect would
 * turn one missing variable into a broken page for the first person who opens the app, so
 * we refuse instead, with the same philosophy as the backend's ProdJwtSecretGuard: a missing
 * APP_ORIGIN fails at deploy time, not at runtime. The docker-compose sets APP_ORIGIN by
 * default, so containers are unaffected; this catches the hosting where it is forgotten.
 *
 * Outside production the request is believed, so `npm run dev` works with no environment.
 */
export function resolveOrigin(headers: Headers, fallbackProtocol: string): string | null {
  const configured = appOrigin();
  if (configured) return configured;
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'APP_ORIGIN não está definido: em produção os redirects entre apps não podem ser ' +
        'construídos a partir dos cabeçalhos do pedido. Define APP_ORIGIN com o endereço ' +
        'público do gateway.',
    );
  }
  return originFromRequest(headers, fallbackProtocol);
}
