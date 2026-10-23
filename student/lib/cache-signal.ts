import { createHmac, timingSafeEqual } from 'node:crypto';

/** O aviso do gestor ao aluno de que dados de referência mudaram (#389).
 *
 *  O aluno guarda 5 minutos os nomes de disciplinas, anos letivos e escolas (`lib/catalog.ts`). Sem aviso, uma
 *  edição no gestor só aparecia ao aluno quando a entrada expirasse. O gestor assina o aviso com o `JWT_SECRET`,
 *  que os dois apps já partilham, e o aluno só esquece a cache se a assinatura bater e o aviso for recente.
 *
 *  Este módulo é puro e é importado pelos dois apps, como o `dev-secret.ts`. */

/** As etiquetas que o aluno guarda em cache: só estas justificam um aviso. */
export const STUDENT_TAGS = ['subjects', 'school-years', 'institutions'] as const;

/** Caminho da rota interna do aluno, sem o basePath. */
export const SIGNAL_PATH = '/api/internal/reference-changed';
export const SIGNATURE_HEADER = 'x-kixi-signature';

/** Um aviso mais velho do que isto é recusado: não se reaproveita um aviso apanhado no caminho. */
const MAX_AGE_MS = 60_000;

export interface Signal {
  tags: string[];
  at: number;
}

export function signSignal(body: string, secret: string): string {
  return createHmac('sha256', secret).update(body).digest('hex');
}

/** O corpo e a assinatura de um aviso para as etiquetas dadas. */
export function buildSignal(tags: string[], secret: string, now: number = Date.now()): { body: string; signature: string } {
  const body = JSON.stringify({ tags, at: now } satisfies Signal);
  return { body, signature: signSignal(body, secret) };
}

/** As etiquetas do aviso, ou null se a assinatura não bater, o aviso for velho ou não fizer sentido. */
export function verifySignal(body: string, signature: string | null, secret: string, now: number = Date.now()): string[] | null {
  if (!signature || !/^[0-9a-f]{64}$/.test(signature)) return null;
  const expected = Buffer.from(signSignal(body, secret), 'hex');
  const given = Buffer.from(signature, 'hex');
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return null;
  }
  const { tags, at } = (parsed ?? {}) as Partial<Signal>;
  if (typeof at !== 'number' || Math.abs(now - at) > MAX_AGE_MS) return null;
  if (!Array.isArray(tags) || !tags.every((t) => typeof t === 'string')) return null;
  return tags;
}
