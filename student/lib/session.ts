import 'server-only';
import { cookies } from 'next/headers';

export const COOKIE = 'auth_token';
export const BACKEND = (process.env.BACKEND_API_URL ?? 'http://localhost:8080/api/v1').replace(/\/$/, '');
/** Where ADMIN accounts are sent: the manager app (same cookie, so no second sign-in). */
export const MANAGER_URL = process.env.NEXT_PUBLIC_MANAGER_URL ?? 'http://localhost:3002/manager';

export type Session = { accountId: number | null; roles: string[]; exp: number };

/** Reads the JWT payload. The backend verifies the signature on every API call; here it only drives the UI. */
export function decode(token?: string): Session | null {
  if (!token) return null;
  try {
    const p = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
    if (typeof p.exp === 'number' && p.exp * 1000 < Date.now()) return null;
    return { accountId: Number(p.sub) || null, roles: Array.isArray(p.roles) ? p.roles : [], exp: p.exp ?? 0 };
  } catch {
    return null;
  }
}

export async function getSession() {
  return decode((await cookies()).get(COOKIE)?.value);
}
