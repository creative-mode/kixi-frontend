import { NextResponse } from 'next/server';
import { MOCK, setMockCorrection, setMockPendingReviewCount } from '@/lib/mock/backend';

/** Força o estado da correção ou as abertas pendentes de uma simulação no mock
 * (`{ "simulationId": 1, "status": "PENDING" }` ou `{ "pendingReviewCount": 1 }`),
 *  para o e2e (#793) ver a nota chegar ao sino sem depender do motor nem do relógio.
 *  `status: ''` volta à regra derivada das respostas. Só existe com o mock ligado:
 *  em produção é um 404, como se a rota não existisse. */
export async function POST(req: Request) {
  if (!MOCK) return new NextResponse(null, { status: 404 });
  const body = (await req.json().catch(() => ({}))) as { simulationId?: unknown; status?: unknown; pendingReviewCount?: unknown };
  const ok = Object.hasOwn(body, 'pendingReviewCount')
    ? setMockPendingReviewCount(Number(body.simulationId), body.pendingReviewCount)
    : setMockCorrection(Number(body.simulationId), typeof body.status === 'string' ? body.status : '');
  return NextResponse.json({ ok }, { status: ok ? 200 : 400 });
}
