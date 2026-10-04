import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import 'server-only';
import { getJwtSecret } from './jwt';

export { API_BASE } from './constants';

/** Headers for backend calls. Only a valid, unexpired ADMIN session gets a token: server actions are public
 *  POST endpoints, so the proxy is not enough; every call re-checks the session itself. */
export async function getAuthHeaders() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;
  if (!token) throw new Error('Não autenticado');

  let roles: string[] = [];
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    roles = (payload.roles as string[]) || [];
  } catch {
    throw new Error('Não autenticado');
  }
  if (!roles.includes('ADMIN')) throw new Error('Não autenticado');

  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };
}

/**
 * Obtém o utilizador atual decodificando o JWT do cookie auth_token.
 * Para uso em Server Components e Route Handlers.
 */
export async function getCurrentUser() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;

    if (!token) return null;

    const { payload } = await jwtVerify(token, getJwtSecret());

    return {
      accountId: Number(payload.sub),
      roles: (payload.roles as string[]) || [],
    };
  } catch (err) {
    console.error('Erro ao obter perfil do usuário:', err);
    return null;
  }
}
