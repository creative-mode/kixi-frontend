import 'server-only';
import { createHash } from 'node:crypto';
import { after } from 'next/server';
import { getAuthHeaders } from '@/lib/auth.server';
import { getJwtSecretValue } from '@/lib/dev-secret';
import { SIGNAL_PATH, SIGNATURE_HEADER, STUDENT_TAGS, buildSignal } from '../../student/lib/cache-signal';
import { friendlyMessage } from './messages';
import { RefCache } from './ref-cache';

/** As entidades de referência (#389): mudam pouco e eram lidas em cada ecrã, em cada select e em cada lista. */
export const REFERENCE_KEYS = ['school-years', 'terms', 'subjects', 'courses', 'classes', 'institutions'] as const;
export type ReferenceKey = (typeof REFERENCE_KEYS)[number];
export const isReference = (key: string): key is ReferenceKey => (REFERENCE_KEYS as readonly string[]).includes(key);

/** Um minuto: chega para o vai-e-vem entre ecrãs, e o que outro gestor alterou aparece depressa.
 *  O que este servidor altera é esquecido logo (`forgetReference`).
 *
 *  Fica em `globalThis` e não numa variável do módulo: o build do Next pode instanciar este módulo mais do que uma
 *  vez (uma por grupo de rotas e actions), e uma escrita numa página tem de esquecer o que as outras guardaram. */
const SHARED = Symbol.for('kixi.manager.reference-cache');
const store = globalThis as typeof globalThis & { [SHARED]?: RefCache };
const cache = (store[SHARED] ??= new RefCache(60_000, 1000));

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

/** Onde o gestor chega ao aluno sem passar pelo gateway: o contentor `student` no compose, a porta 3003 em local. */
const STUDENT_URL = (process.env.STUDENT_INTERNAL_URL ?? 'http://127.0.0.1:3003').replace(/\/$/, '');

/** Avisa o aluno, que guarda os nomes de disciplinas, anos letivos e escolas, para os esquecer já em vez de esperar
 *  que expirem. Corre depois da resposta (`after`): a escrita não espera por ele, e uma falha só fica no log. */
function tellStudent(tags: string[]): void {
  const relevant = tags.filter((t) => (STUDENT_TAGS as readonly string[]).includes(t));
  if (relevant.length === 0) return;
  after(async () => {
    const { body, signature } = buildSignal(relevant, getJwtSecretValue());
    try {
      const res = await fetch(`${STUDENT_URL}/aluno${SIGNAL_PATH}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', [SIGNATURE_HEADER]: signature },
        body,
        cache: 'no-store',
        signal: AbortSignal.timeout(2_000),
      });
      if (!res.ok) console.warn(`[reference] o aluno recusou o aviso (${res.status}): a cache dele expira no prazo`);
    } catch {
      console.warn('[reference] o aluno não respondeu ao aviso: a cache dele expira no prazo');
    }
  });
}

/** Esquece, para todos os utilizadores, o que a escrita em `keys` alterou, aqui e no aluno. */
export function forgetReference(...keys: string[]): void {
  const tags = keys.flatMap((k) => [k, ...(DEPENDENTS[k] ?? [])]);
  cache.forget(...tags);
  tellStudent(tags);
}
