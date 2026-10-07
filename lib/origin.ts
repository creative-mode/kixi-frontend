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
 * because that is what the student app already uses. Only outside production do we
 * fall back to the request, which keeps `npm run dev` working on a laptop with no
 * environment configured.
 */

/** The gateway root, where the landing and the canonical /403 live. Empty string when unset. */
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

/** Last resort, development only: believe the request. */
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

/**
 * The origin to build redirects from. In production this is configuration only; if it
 * is missing we fall back to the request so a misconfigured deployment still redirects
 * (with a warning) instead of hard-failing every login.
 */
export function resolveOrigin(headers: Headers, fallbackProtocol: string): string | null {
  const configured = managerOrigin() ?? appOrigin();
  if (configured) return configured;
  if (process.env.NODE_ENV === 'production') {
    console.warn(
      '[kixi] APP_ORIGIN não está definido: a construir redireccionamentos a partir do pedido. ' +
        'Define APP_ORIGIN com o endereço público do gateway.',
    );
  }
  return originFromRequest(headers, fallbackProtocol);
}
