import { NextResponse } from 'next/server';
import { MOCK, setMockCorrection, setMockPendingReview } from '@/lib/mock/backend';

/** Força o estado da correção de uma simulação no mock (`{ "simulationId": 1, "status": "PENDING" }`),
 *  para o e2e (#793) ver a nota chegar ao sino sem depender do motor nem do relógio.
 *  `status: ''` volta à regra derivada das respostas. `pending: true` põe a resposta
 *  aberta a aguardar correção (e `false` repõe-na), para o e2e do cartão «A corrigir»
 *  (#788) não depender de o seed estar num estado que o #793 precisou de mudar.
 *  Só existe com o mock ligado: em produção é um 404, como se a rota não existisse. */
export async function POST(req: Request) {
  if (!MOCK) return new NextResponse(null, { status: 404 });
  const body = (await req.json().catch(() => ({}))) as { simulationId?: unknown; status?: unknown; pending?: unknown };
  const simulationId = Number(body.simulationId);
  const reviewOk = typeof body.pending === 'boolean' ? setMockPendingReview(simulationId, body.pending) : true;
  const statusOk = setMockCorrection(simulationId, typeof body.status === 'string' ? body.status : '');
  const ok = reviewOk && statusOk;
  return NextResponse.json({ ok }, { status: ok ? 200 : 400 });
}
