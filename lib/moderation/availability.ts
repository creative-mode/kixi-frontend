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

import { friendlyMessage } from '../crud/messages.ts';

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

/** O `detail` do problem+json, quando o corpo o traz e não está vazio. */
function detailOf(body: string): string | null {
  try {
    const detail = JSON.parse(body)?.detail;
    return typeof detail === 'string' && detail.trim() ? detail.trim() : null;
  } catch {
    return null;
  }
}

/**
 * O texto de uma resposta recusada pela moderação. Se o servidor diz porquê (`detail`), é isso que
 * se mostra: «Denúncia não encontrada.» é uma denúncia que já não existe, e «Só o administrador gere a
 * moderação» é um papel em falta, e nenhum dos dois é «rota fechada». Só um 403/404/405/501 sem corpo
 * (o `denyAll` do backend que ainda não tem a moderação) diz que a moderação não está ativa.
 */
export function moderationRefusal(status: number, body: string): string {
  if (status === 401) return friendlyMessage(status, body);
  const detail = detailOf(body);
  if (detail) return detail;
  return routeClosed(status) ? MODERATION_UNAVAILABLE : friendlyMessage(status, body);
}
