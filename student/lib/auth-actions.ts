'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { BACKEND, COOKIE, managerUrl } from './session';
import { MOCK, mockPost } from './mock/auth';

export type FormState = { error?: string; fields?: Record<string, string> } | undefined;

type LoginResponse = { accessToken: string; tokenType: string; expiresAt: string; accountId: number; roles: string[] };

async function detail(res: Response): Promise<string> {
  const j = await res.json().catch(() => ({}));
  const props = j.properties && typeof j.properties === 'object' ? Object.values(j.properties).filter((v) => typeof v === 'string') : [];
  return [j.detail, ...props].filter(Boolean).join(' · ') || j.title || `Erro ${res.status}`;
}

async function startSession(data: LoginResponse): Promise<string> {
  const left = Math.floor((new Date(data.expiresAt).getTime() - Date.now()) / 1000);
  const jar = await cookies();
  jar.set(COOKIE, data.accessToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: left > 0 ? left : 60 * 60 * 24 });
  return data.roles.includes('ADMIN') ? await managerUrl() : '/inicio';
}

async function post(path: string, payload: object): Promise<{ data?: LoginResponse; error?: string }> {
  try {
    const res = MOCK
      ? await mockPost(path, payload as Record<string, unknown>)
      : await fetch(`${BACKEND}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: AbortSignal.timeout(10000), cache: 'no-store' });
    if (!res.ok) {
      if (path === '/auth/login' && (res.status === 400 || res.status === 401)) return { error: 'Utilizador ou palavra-passe incorretos.' };
      return { error: await detail(res) };
    }
    const data = (await res.json()) as LoginResponse;
    if (!data.accessToken) return { error: 'Resposta inválida do servidor.' };
    return { data };
  } catch (e: any) {
    return { error: e?.name === 'TimeoutError' ? 'O servidor demorou a responder. Tenta de novo.' : 'Não foi possível contactar o servidor.' };
  }
}

export async function entrarAction(_: FormState, form: FormData): Promise<FormState> {
  const usernameOrEmail = String(form.get('usernameOrEmail') ?? '').trim();
  const password = String(form.get('password') ?? '');
  if (!usernameOrEmail || !password) return { error: 'Preenche o utilizador e a palavra-passe.', fields: { usernameOrEmail } };
  const { data, error } = await post('/auth/login', { usernameOrEmail, password });
  if (!data) return { error, fields: { usernameOrEmail } };
  redirect(await startSession(data));
}

export async function cadastroAction(_: FormState, form: FormData): Promise<FormState> {
  const f = Object.fromEntries(['firstName', 'lastName', 'username', 'email'].map((k) => [k, String(form.get(k) ?? '').trim()]));
  const password = String(form.get('password') ?? '');
  const confirm = String(form.get('confirm') ?? '');
  if (!f.firstName || !f.lastName || !f.username || !f.email || !password) return { error: 'Preenche todos os campos.', fields: f };
  if (!/^\S+@\S+\.\S+$/.test(f.email)) return { error: 'O email não é válido.', fields: f };
  if (password.length < 8) return { error: 'A palavra-passe precisa de pelo menos 8 caracteres.', fields: f };
  if (password !== confirm) return { error: 'As palavras-passe não coincidem.', fields: f };
  const { data, error } = await post('/auth/register', { ...f, password });
  if (!data) return { error, fields: f };
  redirect(await startSession(data));
}

export async function sairAction() {
  (await cookies()).delete(COOKIE);
  redirect('/entrar');
}
