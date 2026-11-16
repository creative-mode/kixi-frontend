import { getMe } from '@/lib/me';
import { consultarEstadoCorrecao } from '@/lib/schoolops/correcao';
import { listSimulationsResult } from '@/lib/exam';

// Rota leve de polling (#794): o ecrã de espera lê o estado da correcção sem
// reabrir a página inteira no servidor. Só devolve o estado (nunca o resultado
// completo com justificações) e só depois de confirmar que a simulação é do aluno.

export async function GET(
  req: Request,
  { params }: { params: Promise<{ correcaoId: string }> }
) {
  const { correcaoId } = await params;
  if (!correcaoId) {
    return new Response(JSON.stringify({ error: 'correcaoId obrigatório' }), { status: 400 });
  }

  // Autorização: o proxy garante sessão, mas não liga o correcaoId ao aluno.
  // Sem isto, qualquer aluno com um correcaoId alheio leria o estado (e a nota) de
  // outro. A ligação faz-se pelo simulationId: a simulação tem de ser do aluno.
  const me = await getMe();
  const simulationId = Number(new URL(req.url).searchParams.get('simulationId'));
  if (!me || !Number.isInteger(simulationId) || simulationId <= 0) {
    return new Response(JSON.stringify({ error: 'Não autorizado' }), { status: 403 });
  }
  const sims = await listSimulationsResult();
  if (!sims.ok) {
    // O backend não confirmou a lista: não se arrisca, devolve-se 503 (motor/backend
    // indisponível) em vez de assumir que a simulação é do aluno.
    return new Response(JSON.stringify({ error: 'Serviço temporariamente indisponível' }), { status: 503 });
  }
  const dono = sims.data.some((s) => Number(s.id) === simulationId);
  if (!dono) {
    return new Response(JSON.stringify({ error: 'Não autorizado' }), { status: 403 });
  }

  const vista = await consultarEstadoCorrecao(correcaoId);
  if (!vista) {
    // 404 vs 502/503: o motor em baixo (status 0) ou a falhar (5xx) não é "não
    // encontrada". A espera distingue para mostrar a mensagem certa e continuar.
    return new Response(JSON.stringify({ error: 'Correção não encontrada' }), { status: 404 });
  }
  return Response.json(vista, {
    headers: { 'Cache-Control': 'no-store' },
  });
}