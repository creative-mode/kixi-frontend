/** Quantas publicações cabem numa página do feed. O servidor lê a primeira com este
 *  limite e o «Ver mais» pede as seguintes com o mesmo, para o fim ser previsível. */
export const FEED_PAGE_SIZE = 10;

/**
 * Junta páginas sem repetir publicações.
 *
 * A mesma publicação pode chegar em duas páginas quando algo é publicado entre duas
 * leituras: a página 2 passa a começar numa publicação que já estava na página 1. Fica
 * a primeira cópia, na ordem em que apareceu, para a lista não saltar nem duplicar.
 */
export function mergeFeedPages<T extends { id: number }>(...pages: T[][]): T[] {
  const seen = new Set<number>();
  const merged: T[] = [];
  for (const page of pages) {
    for (const post of page) {
      if (seen.has(post.id)) continue;
      seen.add(post.id);
      merged.push(post);
    }
  }
  return merged;
}

/** Uma página com menos linhas do que o limite é a última: não há mais para pedir. */
export function isLastFeedPage(count: number, limit = FEED_PAGE_SIZE): boolean {
  return count < limit;
}
