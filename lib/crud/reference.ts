import 'server-only';
import { createHash } from 'node:crypto';
import { getAuthHeaders } from '@/lib/auth.server';
import { friendlyMessage } from './messages';
import { RefCache } from './ref-cache';

/** As entidades de referência (#389): mudam pouco e eram lidas em cada ecrã, em cada select e em cada lista. */
export const REFERENCE_KEYS = ['school-years', 'terms', 'subjects', 'courses', 'classes', 'institutions'] as const;
export type ReferenceKey = (typeof REFERENCE_KEYS)[number];
export const isReference = (key: string): key is ReferenceKey => (REFERENCE_KEYS as readonly string[]).includes(key);

/** Um minuto: chega para o vai-e-vem entre ecrãs, e o que outro gestor alterou aparece depressa.
 *  O que este servidor altera é esquecido logo (`forgetReference`). */
const cache = new RefCache(60_000, 1000);

/** Quem está a ler, sem guardar a sessão: o hash do token. `getAuthHeaders` valida a sessão primeiro,
 *  por isso uma sessão expirada não lê da cache o que leu antes. */
async function viewer(): Promise<string> {
  const headers = await getAuthHeaders();
  return createHash('sha256').update(headers.Authorization).digest('hex').slice(0, 24);
}

type Read<T> = { ok: true; data: T } | { ok: false; error: string };

/** Um GET com cache por utilizador. `send` faz o pedido; só uma resposta 2xx fica guardada.
 *  Uma falha chega já como frase, porque duas leituras juntas não podem ler o mesmo corpo duas vezes. */
export async function readReference<T>(path: string, tags: readonly string[], send: () => Promise<Response>): Promise<Read<T>> {
  const who = await viewer();
  const result = (await cache.remember(who, path, tags, async () => {
    const res = await send();
    if (!res.ok) {
      const error = friendlyMessage(res.status, await res.text().catch(() => ''));
      return { value: { ok: false, error } satisfies Read<T>, keep: false };
    }
    return { value: { ok: true, data: (await res.json()) as T } satisfies Read<T>, keep: true };
  })) as Read<T>;
  // Cada chamador recebe a sua cópia: a cache é partilhada entre pedidos e quem altera no sítio não a estraga.
  return result.ok ? { ok: true, data: structuredClone(result.data) } : result;
}

/** O que uma escrita numa entidade torna velho. Uma turma (`/classes`) traz o curso e o ano letivo dentro; o currículo
 *  dela (`/classes/{id}/subjects`) vem do curso e das disciplinas, e traz os professores atribuídos a cada uma. */
const DEPENDENTS: Partial<Record<string, string[]>> = {
  courses: ['classes', 'curriculum'],
  'school-years': ['classes'],
  classes: ['curriculum'],
  subjects: ['curriculum'],
  teachers: ['curriculum'],
  'teaching-assignments': ['curriculum'],
};

/** Esquece, para todos os utilizadores, o que a escrita em `keys` alterou. */
export function forgetReference(...keys: string[]): void {
  cache.forget(...keys.flatMap((k) => [k, ...(DEPENDENTS[k] ?? [])]));
}
