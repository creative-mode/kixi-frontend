import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import 'server-only';
import { getJwtSecret } from './jwt';
import { canAccessManager, normalizeRoles } from './roles';

export { API_BASE } from './constants';

/** Headers for backend calls. Only a valid, unexpired manager session gets a
 * token: server actions are public POST endpoints, so the proxy is not enough;
 * every call re-checks the session itself. The backend remains authoritative
 * for resource-level permissions, including ADMIN-only resources. */
export async function getAuthHeaders() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;
  if (!token) throw new Error('Não autenticado');

  let roles = normalizeRoles([]);
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    roles = normalizeRoles(payload.roles);
  } catch {
    throw new Error('Não autenticado');
  }
  // O backend aplica as permissões de cada endpoint: o professor só passa nos que lhe são permitidos.
  if (!canAccessManager(roles)) throw new Error('Não autenticado');

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
      roles: normalizeRoles(payload.roles),
    };
  } catch (err) {
    console.error('Erro ao obter perfil do usuário:', err);
    return null;
  }
}
