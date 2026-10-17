import { NextResponse } from 'next/server';
import { MOCK, setFault } from '@/lib/mock/backend';

/** Liga ou desliga a falha do mock em runtime (`{ "mode": "500" | "timeout" | "" }`), para o e2e
 *  provar o que o aluno vê quando o servidor cai. Só existe com o mock ligado: sem ele é um 404,
 *  como se a rota não existisse. */
export async function POST(req: Request) {
  if (!MOCK) return new NextResponse(null, { status: 404 });
  const body = (await req.json().catch(() => ({}))) as { mode?: unknown };
  setFault(typeof body.mode === 'string' ? body.mode : '');
  return NextResponse.json({ ok: true });
}
