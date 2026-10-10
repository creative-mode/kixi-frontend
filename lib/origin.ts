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

/** The gateway root, where the landing and the canonical /403 live. */
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
    return new URL(raw).origin;
  } catch {
    return null;
  }
}
/**
 * Last resort, outside production only: believe the request.
 *
 * In production this returns null whatever the request says. That is the whole fix: every
 * caller already goes through here or through `resolveOrigin`, so one guard covers the
 * `/403` forwarding, the proxy redirects and the manager handoff at the same time.
 */
export function originFromRequest(headers: Headers, fallbackProtocol: string): string | null {
  if (!emProducao()) {
    const host = headers.get('x-forwarded-host') ?? headers.get('host');
    if (host) {
      const proto = headers.get('x-forwarded-proto') ?? fallbackProtocol.replace(':', '');
      try {
        return new URL(`${proto}://${host}`).origin;
      } catch {
        return null;
      }
    }
  }
  return null;
}

const emProducao = () => process.env.NODE_ENV === 'production';

/**
 * The origin to build redirects from, or null when nothing is configured.
 */
export function resolveOrigin(headers: Headers, fallbackProtocol: string): string | null {
  const configured = managerOrigin() ?? appOrigin();
  if (configured) return configured;
  if (emProducao()) {
    throw new Error(
      'APP_ORIGIN não está definido: em produção os redirects entre apps não podem ser ' +
        'construídos a partir dos cabeçalhos do pedido. Define APP_ORIGIN com o endereço ' +
        'público do gateway.',
    );
  }
  return originFromRequest(headers, fallbackProtocol);
}
