/**
 * Regras das colunas sociais (início e perfil), sem servidor e sem React para o `node --test`
 * as cobrir. Só organiza o que o backend já devolveu: nada aqui inventa um número.
 */

/** As provas terminadas agrupadas por disciplina, da mais frequente para a menos, com `limit` linhas. */
export function groupBySubject(items: { subject?: string | null }[], limit = 4): { name: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    const name = item.subject?.trim();
    if (!name) continue;
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'pt'))
    .slice(0, limit);
}

/** As publicações da própria conta, na ordem em que vieram (a mais recente primeiro). */
export function ownPosts<T extends { authorAccountId: number }>(posts: T[], accountId: number | null): T[] {
  return accountId == null ? [] : posts.filter((p) => p.authorAccountId === accountId);
}

/** Um título comprido de prova cabe num azulejo: corta nas palavras e acrescenta reticências. */
export function shortTitle(title: string, max = 28): string {
  const clean = title.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const space = cut.lastIndexOf(' ');
  return `${(space > max / 2 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

/** Os separadores do perfil; `tab` de um endereço só vale se for um deles. */
export const PROFILE_TABS = ['Publicações', 'Experiência', 'Conquistas', 'Definições'] as const;
export type ProfileTab = (typeof PROFILE_TABS)[number];

export function profileTabOf(value: string | string[] | undefined): ProfileTab {
  const raw = Array.isArray(value) ? value[0] : value;
  // Endereços antigos: os quatro separadores de resultados passaram a um só.
  if (['Atividade', 'Desempenho', 'Medalhas', 'Histórico'].includes(raw ?? '')) return 'Conquistas';
  return (PROFILE_TABS as readonly string[]).includes(raw ?? '') ? (raw as ProfileTab) : 'Publicações';
}
