/** Estado das filas de revisão (filtro e página) no endereço, sem React: testável com `node --test`. */

type Raw = string | string[] | null | undefined;

/** O valor do parâmetro se for um dos permitidos; qualquer outra coisa (em falta, repetida, inventada) volta ao padrão. */
export function parseChoice<T extends string>(raw: Raw, allowed: readonly T[], fallback: T): T {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return allowed.find((choice) => choice === value) ?? fallback;
}

/** A página pedida: um inteiro a partir de 1. Lixo, zero e negativos dão a primeira. */
export function parsePage(raw: Raw): number {
  const n = Number(Array.isArray(raw) ? raw[0] : raw);
  return Number.isInteger(n) && n >= 1 ? n : 1;
}

export interface Paged<T> {
  items: T[];
  /** A página mostrada, já dentro dos limites: pedir a 9.ª de 3 mostra a 3.ª. */
  page: number;
  pages: number;
  total: number;
  /** «Mostrar 11 a 20 de 41»; ambos 0 quando não há nada. */
  first: number;
  last: number;
}

export function paginate<T>(items: readonly T[], page: number, size: number): Paged<T> {
  const total = items.length;
  const pages = Math.max(1, Math.ceil(total / size));
  const current = Math.min(Math.max(1, page), pages);
  const start = (current - 1) * size;
  const slice = items.slice(start, start + size);
  return { items: slice, page: current, pages, total, first: total === 0 ? 0 : start + 1, last: start + slice.length };
}

/**
 * A query string com `patch` aplicado: um valor `null` tira o parâmetro. O resto fica como estava, na ordem em que
 * estava. Devolve `''` ou `?a=b`, pronto a juntar ao caminho.
 */
export function queryWith(search: string, patch: Record<string, string | null>): string {
  const params = new URLSearchParams(search);
  for (const [key, value] of Object.entries(patch)) {
    if (value === null) params.delete(key);
    else params.set(key, value);
  }
  const text = params.toString();
  return text ? `?${text}` : '';
}

/**
 * O separador a ativar com uma tecla do teclado (padrão `tablist` do WAI-ARIA): as setas esquerda e direita andam pelos separadores
 * (dão a volta nas pontas), Home e End vão às pontas. `null` para qualquer outra tecla.
 */
export function nextTabIndex(key: string, index: number, count: number): number | null {
  if (count <= 0) return null;
  if (key === 'ArrowRight') return index >= count - 1 ? 0 : index + 1;
  if (key === 'ArrowLeft') return index <= 0 ? count - 1 : index - 1;
  if (key === 'Home') return 0;
  if (key === 'End') return count - 1;
  return null;
}

/**
 * O item para onde J (`+1`) e K (`-1`) levam o foco. Sem foco numa fila (`current` = -1) o J abre a lista no primeiro
 * e o K no último; nas pontas pára, não dá a volta (andar para lá do fim seria perder o sítio).
 */
export function stepIndex(current: number, count: number, step: 1 | -1): number | null {
  if (count <= 0) return null;
  if (current < 0) return step === 1 ? 0 : count - 1;
  return Math.min(count - 1, Math.max(0, current + step));
}
