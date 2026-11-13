/**
 * Se a moderação e a auditoria existem no servidor (#749).
 *
 * Em `prod` o backend ainda não tem `/api/v1/moderation/*` (kixi#591): as rotas estão fechadas com
 * `denyAll` e respondem 403, que o ecrã mostrava como «Não tem permissão» a um ADMIN. Enquanto o
 * backend não as tem, as duas entradas saem do menu e as páginas dizem a verdade, sem chamar o
 * servidor em vão.
 *
 * `MODERATION_ENABLED=true` liga-as quando o backend as tiver. No modo de demonstração
 * (`KIXI_MOCK=true`) estão sempre ligadas, porque o mock implementa os endpoints. A variável é
 * lida em execução, não no build: ligar a funcionalidade não pede uma imagem nova.
 */

type Env = Record<string, string | undefined>;

export function moderationAvailable(env: Env = process.env): boolean {
  return env.KIXI_MOCK === 'true' || env.MODERATION_ENABLED === 'true';
}

export const MODERATION_UNAVAILABLE =
  'A moderação ainda não está ativa no servidor. Não é falta de permissão: não adianta tentar de novo.';

/**
 * Uma resposta que diz «esta rota não é para ti, nem para ninguém»: o ecrã só chega aqui depois
 * de o guard do frontend confirmar o ADMIN, por isso um 403 (ou um 404/405/501) vindo de uma rota
 * só de ADMIN quer dizer que a rota está fechada ou não existe, e não que falta um papel.
 */
export function routeClosed(status: number): boolean {
  return status === 403 || status === 404 || status === 405 || status === 501;
}
