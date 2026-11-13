import { NextResponse } from 'next/server';
import { parseInstitutions } from '@/lib/institutions';

export const dynamic = 'force-dynamic';

/** O catálogo público ainda não existe (creative-mode/kixi#597): uma falha é uma lista vazia. */
const TIMEOUT_MS = 5_000;
const NO_STORE = { 'Cache-Control': 'no-store' };

/**
 * As escolas que a doação oferece (#763), lidas de `/institutions/public`.
 *
 * Este handler nunca falha por causa do backend: sem lista, o formulário fica no
 * texto livre de sempre e uma doação não se perde por o catálogo estar em baixo.
 */
export async function GET() {
  const backend = (process.env.BACKEND_API_URL ?? '').replace(/\/$/, '');
  if (!backend) return NextResponse.json({ institutions: [] }, { headers: NO_STORE });

  try {
    const response = await fetch(`${backend}/institutions/public`, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) return NextResponse.json({ institutions: [] }, { headers: NO_STORE });
    const body = await response.json().catch(() => null);
    return NextResponse.json({ institutions: parseInstitutions(body) }, { headers: NO_STORE });
  } catch {
    return NextResponse.json({ institutions: [] }, { headers: NO_STORE });
  }
}
