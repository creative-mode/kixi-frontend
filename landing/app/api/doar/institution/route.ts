import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { parseSessionInstitution } from '@/lib/institutions';
import { SESSION_COOKIE } from '@/lib/session-destination';

export const dynamic = 'force-dynamic';

const TIMEOUT_MS = 5_000;
const NO_STORE = { 'Cache-Control': 'no-store' };
const nobody = () => NextResponse.json({ institution: null }, { headers: NO_STORE });

/**
 * A escola de quem está com sessão iniciada (#763), para o formulário já a propor.
 *
 * O cookie é httpOnly e partilhado pelas três apps; a landing só o repassa ao
 * backend. Sem sessão, ou se o backend não responder, a resposta é «nenhuma» — a
 * pré-selecção é uma conveniência, nunca uma condição para doar.
 */
export async function GET() {
  const backend = (process.env.BACKEND_API_URL ?? '').replace(/\/$/, '');
  if (!backend) return nobody();

  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return nobody();

  try {
    const response = await fetch(`${backend}/me`, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) return nobody();
    const body = await response.json().catch(() => null);
    return NextResponse.json({ institution: parseSessionInstitution(body) }, { headers: NO_STORE });
  } catch {
    return nobody();
  }
}
