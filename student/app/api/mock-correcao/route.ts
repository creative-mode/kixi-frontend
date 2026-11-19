import { NextResponse } from 'next/server';
import { MOCK, setMockCorrection, setMockPendingReview, setMockPendingReviewCount } from '@/lib/mock/backend';
import { setMotorSimulado } from '@/lib/mock/motor';

/** Com `motor` em vez de `status`, combina o estado que o SchoolOps daria à simulação
 *  (`{ "simulationId": 1, "motor": { "estado": "ABERTA", "progresso": { "corrigidas": 2, "total": 5 }, "previsaoSegundos": 60 } }`),
 *  para se ver o ecrã de espera com o progresso e a previsão (#792); `"motor": null` tira-o.
 *
 *  Força o estado da correção de uma simulação no mock (`{ "simulationId": 1, "status": "PENDING" }`),
 *  para o e2e (#793) ver a nota chegar ao sino sem depender do motor nem do relógio.
 *  `status: ''` volta à regra derivada das respostas. `pending: true` põe a resposta
 *  aberta a aguardar correção (e `false` repõe-na), para o e2e do cartão «A corrigir»
 *  (#788) não depender de o seed estar num estado que o #793 precisou de mudar.
 *  Só existe com o mock ligado: em produção é um 404, como se a rota não existisse. */
export async function POST(req: Request) {
  if (!MOCK) return new NextResponse(null, { status: 404 });
  const body = (await req.json().catch(() => ({}))) as { simulationId?: unknown; status?: unknown; pending?: unknown; pendingReviewCount?: unknown; motor?: unknown };
  if ('motor' in body) {
    const id = Number(body.simulationId);
    const motor = body.motor as { estado?: unknown } | null;
    if (!Number.isInteger(id) || id <= 0 || (motor !== null && (typeof motor !== 'object' || typeof motor.estado !== 'string'))) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }
    setMotorSimulado(id, motor as Parameters<typeof setMotorSimulado>[1]);
    return NextResponse.json({ ok: true });
  }
  const simulationId = Number(body.simulationId);
  // `pendingReviewCount` força o número que o resultado traz (#790); `pending` põe a resposta aberta por corrigir (#788).
  const countOk = Object.hasOwn(body, 'pendingReviewCount') ? setMockPendingReviewCount(simulationId, body.pendingReviewCount) : true;
  const reviewOk = typeof body.pending === 'boolean' ? setMockPendingReview(simulationId, body.pending) : true;
  const statusOk = Object.hasOwn(body, 'pendingReviewCount') && !Object.hasOwn(body, 'status') ? true : setMockCorrection(simulationId, typeof body.status === 'string' ? body.status : '');
  const ok = countOk && reviewOk && statusOk;
  return NextResponse.json({ ok }, { status: ok ? 200 : 400 });
}
