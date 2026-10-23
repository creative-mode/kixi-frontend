'use server';

import { cookies, headers } from 'next/headers';
import { redirectFromAction } from '@/lib/action-redirect';
import { apiFetch } from '@/lib/mock/fetch';
import { API_BASE } from '@/lib/constants';
import { canAccessManager, normalizeRoles } from '@/lib/roles';
import { forwardedFor, loginLimitMessage } from '@/lib/auth-rules';

interface LoginResponse {
  accessToken: string;
  tokenType: string;
  expiresAt: string;
  accountId: number;
  roles: string[];
}

export async function loginAction(formData: FormData) {
  const usernameOrEmail = String(formData.get('usernameOrEmail') ?? '').trim();
  const password = String(formData.get('password') ?? '');

  if (!usernameOrEmail || !password) {
    return { error: 'Username ou email e password são obrigatórios' };
  }

  try {
    // Derivado de BACKEND_API_URL, a única variável que o resto do gestor e o docker-compose definem.
    // Uma variável própria com omissão fixa mandava o login para outro serviço (porta 8080).
    const backendUrl = `${API_BASE.replace(/\/$/, '')}/auth/login`;

    // O backend só vê o contentor do front como origem: sem o IP real, o limite de tentativas por
    // endereço contaria todos os utilizadores como um só.
    const clientIp = forwardedFor((await headers()).get('x-forwarded-for'));
    const response = await apiFetch(backendUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(clientIp ? { 'X-Forwarded-For': clientIp } : {}) },
      body: JSON.stringify({ usernameOrEmail, password }),
      signal: AbortSignal.timeout(10000),
    });

    if (response.status === 400 || response.status === 401) {
      return { error: 'Utilizador ou palavra-passe incorretos.' };
    }

    const limited = loginLimitMessage(response.status, response.headers.get('retry-after'));
    if (limited) return { error: limited };

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        error:
          errorData.detail ||
          errorData.message ||
          errorData.error ||
          `Erro ${response.status}: Falha na autenticação`,
      };
    }

    const data = (await response.json()) as LoginResponse;
    const roles = normalizeRoles(data.roles);
    const expiresAt = Date.parse(data.expiresAt);

    if (!data.accessToken || !data.tokenType?.toLowerCase().includes('bearer')) {
      return { error: 'Resposta inválida do servidor (token não recebido)' };
    }

    if (!canAccessManager(roles)) {
      return {
        error:
          'Acesso negado. Apenas administradores e professores podem aceder ao Kixi Manager.',
      };
    }

    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
      return { error: 'Esta conta não tem acesso válido ao Kixi Manager.' };
    }

    const maxAgeSeconds = Math.max(1, Math.floor((expiresAt - Date.now()) / 1000));
    const cookieStore = await cookies();
    // Cookie Secure só em HTTPS (direto ou atrás de um proxy TLS); em HTTP o browser descartaria o cookie e o login não ficaria guardado.
    const secure = (await headers()).get('x-forwarded-proto') === 'https';

    cookieStore.set('auth_token', data.accessToken, {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      path: '/',
      expires: new Date(expiresAt),
      maxAge: maxAgeSeconds,
    });

    cookieStore.set(
      'user_info',
      JSON.stringify({ accountId: data.accountId, roles }),
      {
        httpOnly: false,
        secure,
        sameSite: 'lax',
        path: '/',
        expires: new Date(expiresAt),
        maxAge: maxAgeSeconds,
      },
    );

    return { success: true };
  } catch (error: unknown) {
    console.error('Erro durante login:', error);
    return {
      error:
        error instanceof Error && error.name === 'TimeoutError'
          ? 'O servidor demorou muito a responder. Tente novamente.'
          : 'Erro ao conectar com o servidor de autenticação',
    };
  }
}

export async function logoutAction() {
  const cookieStore = await cookies();
  cookieStore.delete('auth_token');
  cookieStore.delete('user_info');
  await redirectFromAction('/login?reason=logged-out');
}
