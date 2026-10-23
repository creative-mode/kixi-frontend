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
import { validateRuntimeConfiguration } from './lib/dev-secret';

export function register() {
  let mode: 'mock' | 'real';
  try {
    mode = validateRuntimeConfiguration();
  } catch (error) {
    console.error(`[kixi] Configuração de backend inválida: ${String(error)}`);
    if (process.env.NEXT_RUNTIME === 'nodejs') process.exit(1);
    throw error;
  }

  if (mode === 'mock') console.warn('[kixi] MODO DEMONSTRAÇÃO: backend simulado ativo; não usar dados reais.');
  if (process.env.NODE_ENV !== 'production') return;
  // Sem isto, o aviso ao aluno de que dados de referência mudaram (#389) vai para 127.0.0.1:3003, que num contentor
  // não é o aluno: falharia em cada escrita, só com uma linha no log, e o aluno voltava a esperar os 5 minutos da
  // cache sem ninguém dar por isso. Não impede o arranque, porque o gestor funciona na mesma; diz-se logo aqui.
  if (!process.env.STUDENT_INTERNAL_URL?.trim()) {
    console.error(
      '[kixi] STUDENT_INTERNAL_URL não está definido: o gestor não consegue avisar o aluno quando uma disciplina, ' +
        'um ano letivo ou uma escola muda, e o aluno só vê a mudança quando a cache dele expirar (5 min). ' +
        'Define-o com o endereço interno do aluno (no docker-compose: http://student:3003).',
    );
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
