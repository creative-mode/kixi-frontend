/**
 * Recusa arrancar em produção sem `APP_ORIGIN`.
 *
 * O `resolveOrigin` já recusa, mas isso só acontece no primeiro pedido: a app ficava
 * `Ready` e respondia 500 a tudo, o que é o pior dos dois mundos — parece que arrancou, e o
 * primeiro professor ou aluno que chegar vê um erro sem explicação. Falhar no arranque põe
 * o problema no deploy, que é onde se resolve.
 *
 * Mesma filosofia do `ProdJwtSecretGuard` do backend. O `docker-compose.yml` define
 * `APP_ORIGIN` por omissão, por isso contentores não são afectados; isto apanha o alojamento
 * onde a variável ficou por definir.
 *
 * O `process.exit(1)` é o que faz o processo morrer: sem ele o Next regista o erro, marca o
 * `register()` como falhado e continua a responder 500. O `throw` cobre o runtime `edge`, onde
 * não há processo para matar.
 */
/** Em produção, dados simulados só com autorização explícita (KIXI_MOCK=true e KIXI_ALLOW_MOCK_IN_PROD=true).
 *  Sem isto, um deploy a que falte KIXI_MOCK=false serviria contas, provas e notas inventadas sem erro nenhum. */
function mockEmProducaoSemAutorizacao() {
  const mockLigado = process.env.KIXI_MOCK !== 'false';
  return mockLigado && process.env.KIXI_ALLOW_MOCK_IN_PROD !== 'true';
}

export function register() {
  if (process.env.NODE_ENV !== 'production') return;
  if (mockEmProducaoSemAutorizacao()) {
    console.error(
      '[kixi] O backend simulado está ligado em produção. Define KIXI_MOCK=false com BACKEND_API_URL ' +
        'e JWT_SECRET. Só para uma demonstração, define também KIXI_ALLOW_MOCK_IN_PROD=true.',
    );
    if (process.env.NEXT_RUNTIME === 'nodejs') process.exit(1);
    throw new Error('KIXI_MOCK ligado em produção');
  }
  if (process.env.APP_ORIGIN?.trim()) return;

  console.error(
    '[kixi] APP_ORIGIN não está definido: em produção é obrigatório, porque os redirects ' +
      'entre apps não podem ser construídos a partir dos cabeçalhos do pedido. Define ' +
      'APP_ORIGIN com o endereço público do gateway.',
  );
  if (process.env.NEXT_RUNTIME === 'nodejs') process.exit(1);
  throw new Error('APP_ORIGIN não está definido');
}