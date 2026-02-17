import { cookies } from 'next/headers';
import 'server-only';
export const API_BASE = process.env.BACKEND_API_URL ?? 'http://localhost:8080/api/v1';

export async function getAuthHeaders() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;

  if (!token) {
    throw new Error('Não autenticado');
  }

  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };
}

export async function getCurrentUser() {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers,
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      accountId: data.accountId,
      roles: data.roles,
      name: data.name,
      role: data.role,
      id: data.id,
    };
  } catch (err) {
    console.error('Erro ao obter perfil do usuário:', err);
    return null;
  }
}
