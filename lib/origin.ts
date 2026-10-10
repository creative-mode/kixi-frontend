/**
 * Public origin of the deployment, for the redirects that cross app boundaries.
 *
 * The origin the browser sees is not the one Next receives: behind the gateway
 * (scripts/gateway.mjs) each app gets an internal host and the public address
 * arrives in `x-forwarded-host`. That header — like `Host` — is chosen by whoever
 * made the request, so a redirect assembled from it is an open redirect: forge the
 * header and the victim lands on a domain of the attacker's choosing.
 *
 * So the origin is configuration, not a header. `APP_ORIGIN` is the gateway root
 * (the landing); `NEXT_PUBLIC_MANAGER_URL` points at this app and wins when set,
 * because that is what the student app already uses. In production there is no fallback at
 * all: without APP_ORIGIN the app refuses to boot, the same philosophy as the backend's
 * ProdJwtSecretGuard, so a missing variable shows up at deploy time instead of as a broken
 * page for the first person who opens it. Only outside production do we fall back to the
 * request, which keeps `npm run dev` working on a laptop with no environment configured.
 */

/** The gateway root, where the landing and the canonical /403 live. Null when unset. */
export function appOrigin(): string | null {
  return origin(process.env.APP_ORIGIN);
}

/** This app's own public address. */
export function managerOrigin(): string | null {
  return origin(process.env.NEXT_PUBLIC_MANAGER_URL) ?? appOrigin();
}

function origin(value: string | undefined): string | null {
  const raw = value?.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.origin;
  } catch {
    return null;
  }
}

/**
 * Last resort, outside production only: believe the request.
 *
 * In production this returns null whatever the request says. The guard is here as well as in
 * `resolveOrigin`: this function is exported, and an export that is only correct by
 * convention is one a future import breaks silently.
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
 * In production this is configuration or nothing, and a missing APP_ORIGIN stops the app at
 * boot (see `instrumentation.ts`) before it ever gets here. This throw is the second line of
 * defence, for a runtime that starts without going through instrumentation.
 *
 * Outside production the request is believed, so `npm run dev` works with no environment.
 */
export function resolveOrigin(headers: Headers, fallbackProtocol: string): string | null {
  const configured = managerOrigin() ?? appOrigin();
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
