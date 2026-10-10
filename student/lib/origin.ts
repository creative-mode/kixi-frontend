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
 * configuration.
 *
 * Outside production the request is believed, so `npm run dev` works with no environment
 * set. Inside production it is not: `originFromRequest` returns null and the callers fall
 * back to a same-origin redirect rather than to whatever host the request asked for.
 * Setting `APP_ORIGIN` is therefore not optional in production; when it is missing the
 * cross-app redirects simply do not happen, and the learner sees a 403 screen instead of
 * being sent somewhere untrusted.
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
 *
 * In production this is configuration or nothing. A redirect built from `x-forwarded-host`
 * is an open redirect, and degrading to a same-origin redirect turns one missing variable
 * into a broken page for the first person who opens the app. So in production we refuse,
 * with the same philosophy as the backend's ProdJwtSecretGuard: a missing APP_ORIGIN has to
 * fail at deploy time, not at runtime. The docker-compose sets APP_ORIGIN by default, so a
 * container deployment is unaffected; this catches the hosting where someone forgets it.
 *
 * Outside production the request is believed, so `npm run dev` works with no environment.
 */
export function resolveOrigin(headers: Headers, fallbackProtocol: string): string | null {
  const configured = appOrigin();
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
