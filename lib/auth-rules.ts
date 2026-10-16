/** Regras do login do gestor, sem servidor e sem React (o aluno tem as suas em
 *  student/lib/auth-rules.ts: são dois apps Next separados, por isso não partilham código). */

/** Mensagem para um login limitado pelo backend (429), ou `null` para os outros erros. */
export function loginLimitMessage(status: number, retryAfter: string | null): string | null {
  if (status !== 429) return null;
  const seconds = Number(retryAfter?.trim());
  const minutes = Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds / 60) : null;
  const wait = minutes == null ? 'daqui a pouco' : minutes <= 1 ? 'daqui a 1 minuto' : `daqui a ${minutes} minutos`;
  return `Demasiadas tentativas. Tenta de novo ${wait}.`;
}

/** O `X-Forwarded-For` a repassar ao backend, ou `null`. Só se aceita uma lista de IPs: o valor
 *  vai para um cabeçalho de um pedido novo. O backend só acredita nele se quem o envia for um
 *  proxy nomeado em `APP_TRUSTED_PROXY_IPS`. */
export function forwardedFor(header: string | null | undefined): string | null {
  const value = header?.trim();
  if (!value || value.length > 200) return null;
  return /^[0-9a-fA-F:.]+(\s*,\s*[0-9a-fA-F:.]+)*$/.test(value) ? value : null;
}
