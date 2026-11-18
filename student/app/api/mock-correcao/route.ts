import { NextResponse } from 'next/server';
import { MOCK, setMockCorrection } from '@/lib/mock/backend';
import { setMotorSimulado } from '@/lib/mock/motor';

/** Com `motor` em vez de `status`, combina o estado que o SchoolOps daria à simulação
 *  (`{ "simulationId": 1, "motor": { "estado": "ABERTA", "progresso": { "corrigidas": 2, "total": 5 }, "previsaoSegundos": 60 } }`),
 *  para se ver o ecrã de espera com o progresso e a previsão (#792); `"motor": null` tira-o.
 *
 *  Força o estado da correção de uma simulação no mock (`{ "simulationId": 1, "status": "PENDING" }`),
 *  para o e2e (#793) ver a nota chegar ao sino sem depender do motor nem do relógio.
 *  `status: ''` volta à regra derivada das respostas. Só existe com o mock ligado:
 *  em produção é um 404, como se a rota não existisse. */
export async function POST(req: Request) {
  if (!MOCK) return new NextResponse(null, { status: 404 });
  const body = (await req.json().catch(() => ({}))) as { simulationId?: unknown; status?: unknown; motor?: unknown };
  if ('motor' in body) {
    const id = Number(body.simulationId);
    const motor = body.motor as { estado?: unknown } | null;
    if (!Number.isInteger(id) || id <= 0 || (motor !== null && (typeof motor !== 'object' || typeof motor.estado !== 'string'))) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }
    setMotorSimulado(id, motor as Parameters<typeof setMotorSimulado>[1]);
    return NextResponse.json({ ok: true });
  }
  const ok = setMockCorrection(Number(body.simulationId), typeof body.status === 'string' ? body.status : '');
  return NextResponse.json({ ok }, { status: ok ? 200 : 400 });
}
