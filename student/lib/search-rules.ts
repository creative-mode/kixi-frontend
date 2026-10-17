/** Regras da pesquisa de perfis (escolas, professores e alunos), sem servidor e sem React. */

/** Abaixo disto não se pergunta ao servidor: devolveria quase toda a gente. */
export const MIN_QUERY = 2;

/** Tira acentos e maiúsculas, para «jose» encontrar «José». */
export function fold(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
}

/** Todas as palavras da pesquisa têm de aparecer no nome, por qualquer ordem. */
export function matchesName(query: string, name: string): boolean {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return false;
  const target = fold(name);
  return words.every((w) => target.includes(w));
}

export function normalizeQuery(raw: string | string[] | undefined): string {
  return (Array.isArray(raw) ? raw[0] : raw)?.trim() ?? '';
}

export const isSearchable = (q: string) => q.length >= MIN_QUERY;

/** Junta resultados de várias escolas sem repetir a mesma pessoa. */
export function uniqueBy<T>(items: T[], key: (item: T) => string | number): T[] {
  const seen = new Set<string | number>();
  return items.filter((i) => {
    const k = key(i);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
