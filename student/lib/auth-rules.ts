/** Regras de apresentação do cadastro e do login, sem servidor e sem React.
 *
 *  O backend responde em inglês e, num registo repetido, não diz qual dos dois campos
 *  (utilizador ou email) já existe: de propósito, para não dar a ninguém uma forma de
 *  descobrir que emails têm conta. A mensagem em português mantém essa regra. */

/** Mensagem para uma falha de autenticação que o aluno consegue resolver, ou `null` quando
 *  não há uma melhor do que a que o servidor deu. */
export function authFailureMessage(
  path: '/auth/login' | '/auth/register' | string,
  status: number,
  retryAfterSeconds: number | null,
): string | null {
  if (status === 429) {
    const minutes = retryAfterSeconds && retryAfterSeconds > 0 ? Math.ceil(retryAfterSeconds / 60) : null;
    const wait = minutes == null ? 'daqui a pouco' : minutes <= 1 ? 'daqui a 1 minuto' : `daqui a ${minutes} minutos`;
    return `Demasiadas tentativas. Tenta de novo ${wait}.`;
  }
  if (path === '/auth/register' && status === 409) {
    return 'Este utilizador ou email já tem conta. Entra na tua conta ou escolhe outros dados.';
  }
  if (status === 503) {
    return 'Esta ação está temporariamente indisponível. Tenta de novo daqui a pouco.';
  }
  return null;
}

/** O valor de `Retry-After` em segundos, quando é um número (a forma como o backend o envia). */
export function retryAfterSeconds(header: string | null): number | null {
  if (!header) return null;
  const seconds = Number(header.trim());
  return Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : null;
}

/** O `X-Forwarded-For` a repassar ao backend, ou `null`. Só se aceita o que parece uma lista
 *  de endereços IP: o valor vai para um cabeçalho de um pedido novo, por isso nada de
 *  quebras de linha nem texto livre. O backend só acredita nele se quem o envia for um
 *  proxy nomeado em `APP_TRUSTED_PROXY_IPS`. */
export function forwardedFor(header: string | null | undefined): string | null {
  const value = header?.trim();
  if (!value || value.length > 200) return null;
  return /^[0-9a-fA-F:.]+(\s*,\s*[0-9a-fA-F:.]+)*$/.test(value) ? value : null;
}
