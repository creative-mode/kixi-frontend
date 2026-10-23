import { isIP } from 'node:net';

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

/** Repassa ao backend apenas o último salto da cadeia validada pelo gateway. */
export function forwardedFor(header: string | null | undefined): string | null {
  const value = header?.trim();
  if (!value || value.length > 200) return null;
  const addresses = value.split(',').map((address) => address.trim());
  if (addresses.some((address) => isIP(address) === 0)) return null;
  return addresses.at(-1) ?? null;
}
