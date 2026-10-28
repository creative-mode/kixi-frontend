import 'server-only';
import { cookies, headers } from 'next/headers';
import { verificarSessao } from './jwt';
import { managerUrl as configuredManagerUrl, originFromRequest } from './origin';

export const COOKIE = 'auth_token';
export const BACKEND = (process.env.BACKEND_API_URL ?? 'http://localhost:8080/api/v1').replace(/\/$/, '');

/** Where ADMIN accounts are sent: the manager app (same cookie, so no second sign-in).
 *  Configured origin first; the request headers are only trusted outside production. */
export async function managerUrl(): Promise<string> {
  const configured = configuredManagerUrl();
  if (configured) return configured;
  const h = await headers();
  const origin = originFromRequest(h, 'http') ?? 'http://localhost:3000';
  return `${origin}/manager`;
}

export type { Session } from './jwt';

/** A sessão do pedido, com a assinatura do token verificada. */
export async function getSession() {
  return verificarSessao((await cookies()).get(COOKIE)?.value);
}
