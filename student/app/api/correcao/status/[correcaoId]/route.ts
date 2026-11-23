import { getMe } from '@/lib/me';
import { consultarEstadoCorrecao } from '@/lib/schoolops/correcao';
import { estadoParaEspera } from '@/lib/schoolops/correcao-rules';
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

  const estado = await consultarEstadoCorrecao(correcaoId);
  if (!estado.ok) {
    // Só um 404 do motor é "não existe". Um 0 (motor fora) ou um 5xx é "não sei agora":
    // a espera volta a ler em vez de desistir (e mostra a mensagem certa).
    if (estado.status === 404) {
      return new Response(JSON.stringify({ error: 'Correção não encontrada' }), { status: 404 });
    }
    return new Response(JSON.stringify({ error: 'Serviço temporariamente indisponível' }), { status: 503 });
  }
  // Só o estado e, enquanto se corrige, o progresso e a previsão: nunca o resultado completo (pontos, justificações)
  // nem dados de outro aluno.
  return Response.json(estadoParaEspera(estado.vista), {
    headers: { 'Cache-Control': 'no-store' },
  });
}