import { getCurrentUser } from '@/lib/auth.server';
import { call, message } from '@/lib/crud/http';

// O painel ao vivo da sala (BE-17): `GET /exam-rooms/{id}/live` é um stream SSE
// que o backend actualiza a cada 2 s e fecha quando a sala encerra.
//
// O browser não pode ligar-se ao backend directamente: o token está num cookie
// httpOnly deste domínio e o backend quer `Authorization: Bearer`. Esta rota
// junta o cabeçalho e devolve o corpo tal como chega, sem o ler.
//
// O `proxy.ts` não corre em `/api`, por isso a sessão é verificada aqui. Quem
// decide se a sala é dele é o backend (`ExamRoomMonitoringService`).

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !(user.roles.includes('ADMIN') || user.roles.includes('TEACHER'))) {
    return new Response('Sessão expirada.', { status: 401 });
  }
  const { id } = await params;
  if (!/^\d+$/.test(id)) return new Response('Sala inválida.', { status: 400 });

  // O pedido ao backend acaba quando o browser fecha o EventSource.
  const upstream = await call(`/api/v1/exam-rooms/${id}/live`, {
    headers: { Accept: 'text/event-stream' },
    signal: request.signal,
  });
  if (!upstream.ok || !upstream.body) {
    return new Response(await message(upstream), { status: upstream.status || 502 });
  }
  return new Response(upstream.body, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      // Sem isto, um nginx à frente guarda os eventos e entrega-os todos no fim.
      'X-Accel-Buffering': 'no',
    },
  });
}
