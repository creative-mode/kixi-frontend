/**
 * A decisão de que destinos cabem em cada barra (#704). Puro e sem React, para o
 * `node --test` chegar cá: a barra inferior do telemóvel tem 4 colunas, por isso
 * um item a mais parte o último para uma segunda linha (foi o que aconteceu ao
 * Tutor quando as Pautas entraram). A barra lateral do desktop não tem esse limite.
 */
export interface ShellNavItem {
  href: string;
  label: string;
  icon: string;
  /** Páginas que também acendem o item (ex.: `/prova` acende «Provas»). */
  also: string[];
  /** Só no desktop: a pesquisa já vive no cabeçalho do telemóvel. */
  desktopOnly?: boolean;
  /** Só no desktop por falta de espaço: no telemóvel chega-se lá pelo perfil (#704). */
  mobileHidden?: boolean;
}

/** O que a barra inferior do telemóvel mostra, pela ordem dos itens. */
export function mobileNavItems<T extends ShellNavItem>(items: readonly T[]): T[] {
  return items.filter((item) => !item.desktopOnly && !item.mobileHidden);
}
