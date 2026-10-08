'use server';

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { appPath } from '@/lib/paths';
import { BACKEND, COOKIE, managerUrl } from './session';
import { MOCK, mockPost } from './mock/backend';
import { problem } from './api';
import { canAccessManager, normalizeRoles } from '@/lib/roles';

export type FormState = { error?: string; fields?: Record<string, string> } | undefined;

type LoginResponse = {
  accessToken: string;
  tokenType: string;
  expiresAt: string;
  accountId: number;
  roles: string[];
};

async function startSession(data: LoginResponse): Promise<string | null> {
  const expiresAt = Date.parse(data.expiresAt);
  const roles = normalizeRoles(data.roles);

  if (!data.accessToken || !Number.isFinite(expiresAt) || expiresAt <= Date.now() || roles.length === 0) {
    return null;
  }

  const jar = await cookies();
  const secure = (await headers()).get('x-forwarded-proto') === 'https';

  jar.set(COOKIE, data.accessToken, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    expires: new Date(expiresAt),
    maxAge: Math.max(1, Math.floor((expiresAt - Date.now()) / 1000)),
  });

  return canAccessManager(roles) ? await managerUrl() : '/inicio';
}

/** A destination that may already be an absolute URL to the manager, which keeps its own
 *  origin and must not be prefixed. Only the paths of this app need the basePath. */
function toAppPath(destination: string): string {
  return /^https?:\/\//.test(destination) ? destination : appPath(destination);
}

async function post(
  path: string,
  payload: object,
): Promise<{ data?: LoginResponse; error?: string }> {
  try {
    const res = MOCK
      ? await mockPost(path, payload as Record<string, unknown>)
      : await fetch(`${BACKEND}${path}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(10000),
          cache: 'no-store',
        });

    if (!res.ok) {
      if (path === '/auth/login' && (res.status === 400 || res.status === 401)) {
        return { error: 'Utilizador ou palavra-passe incorretos.' };
      }
      return { error: (await problem(res)).message };
    }

    const data = (await res.json()) as LoginResponse;
    if (!data.accessToken) return { error: 'Resposta inválida do servidor.' };
    return { data };
  } catch (error: unknown) {
    return {
      error:
        error instanceof Error && error.name === 'TimeoutError'
          ? 'O servidor demorou a responder. Tenta de novo.'
          : 'Não foi possível contactar o servidor.',
    };
  }
}

export async function entrarAction(_: FormState, form: FormData): Promise<FormState> {
  const usernameOrEmail = String(form.get('usernameOrEmail') ?? '').trim();
  const password = String(form.get('password') ?? '');

  if (!usernameOrEmail || !password) {
    return { error: 'Preenche o utilizador e a palavra-passe.', fields: { usernameOrEmail } };
  }

  const { data, error } = await post('/auth/login', { usernameOrEmail, password });
  if (!data) return { error, fields: { usernameOrEmail } };

  const destination = await startSession(data);
  if (!destination) {
    return { error: 'Resposta de sessão inválida. Tenta novamente.', fields: { usernameOrEmail } };
  }

  redirect(toAppPath(destination));
}

export async function cadastroAction(_: FormState, form: FormData): Promise<FormState> {
  const fields = Object.fromEntries(
    ['firstName', 'lastName', 'username', 'email'].map((key) => [
      key,
      String(form.get(key) ?? '').trim(),
    ]),
  );
  const password = String(form.get('password') ?? '');
  const confirm = String(form.get('confirm') ?? '');

  if (!fields.firstName || !fields.lastName || !fields.username || !fields.email || !password) {
    return { error: 'Preenche todos os campos.', fields };
  }
  if (!/^\S+@\S+\.\S+$/.test(fields.email)) {
    return { error: 'O email não é válido.', fields };
  }
  if (password.length < 8) {
    return { error: 'A palavra-passe precisa de pelo menos 8 caracteres.', fields };
  }
  if (password !== confirm) {
    return { error: 'As palavras-passe não coincidem.', fields };
  }

  const { data, error } = await post('/auth/register', { ...fields, password });
  if (!data) return { error, fields };

  const destination = await startSession(data);
  if (!destination) return { error: 'Resposta de sessão inválida. Tenta novamente.', fields };

  redirect(toAppPath(destination));
}

export async function sairAction() {
  const jar = await cookies();
  jar.delete(COOKIE);
  jar.delete('user_info');
  redirect(appPath('/entrar?reason=logged-out'));
}
