'use server'
import { cookies } from 'next/headers';


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

export async function fetchCurrentUser(): Promise<CurrentUser | null> {
   try {
     const headers = await getAuthHeaders();
     const res = await fetch(`${API_BASE}/auth/me`, {  // endpoint que devolve o user atual
       headers,
       cache: 'no-store',
     });

     if (!res.ok) return null;

     const data = await res.json();
     return {
       accountId: data.accountId,
       roles: data.roles,
     };
   } catch (err) {
     console.error('Erro ao obter perfil do usuário:', err);
     return null;
   }
}



export const API_BASE = process.env.BACKEND_API_URL ?? 'http://localhost:8080/api/v1';