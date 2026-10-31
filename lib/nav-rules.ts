/** Regras do menu do gestor, sem React nem ícones: ficam testáveis com `node --test`. */

export type NavGroupId = 'ensino' | 'estrutura' | 'administracao';

export const NAV_GROUPS: { id: NavGroupId; label: string }[] = [
  { id: 'ensino', label: 'Ensino' },
  { id: 'estrutura', label: 'Estrutura' },
  { id: 'administracao', label: 'Administração' },
];

/** A que grupo pertence cada destino. O início (`/` e `/professor`) fica de fora: vai no topo, sem grupo. */
const GROUP_OF: Record<string, NavGroupId> = {
  '/exam-rooms': 'ensino',
  '/exam-builder': 'ensino',
  '/statements': 'ensino',
  '/simulations': 'ensino',
  '/simulation-answers': 'ensino',
  '/tarefas': 'ensino',
  '/pautas': 'ensino',
  '/desempenho': 'ensino',
  '/professor/tutor': 'ensino',

  '/school-year': 'estrutura',
  '/terms': 'estrutura',
  '/subjects': 'estrutura',
  '/courses': 'estrutura',
  '/classes': 'estrutura',
  '/institutions': 'estrutura',
  '/assign': 'estrutura',
  '/teaching-assignments': 'estrutura',
  '/enrollments': 'estrutura',

  '/teachers': 'administracao',
  '/accounts': 'administracao',
  '/users': 'administracao',
  '/roles': 'administracao',
  '/sessions': 'administracao',
  '/donations': 'administracao',
  '/verification': 'administracao',
  '/moderacao': 'administracao',
};

const TOP = new Set(['/', '/professor']);

export type NavLinkBase = { href: string };

export type NavLayout<T extends NavLinkBase> = {
  top: T[];
  groups: { id: NavGroupId; label: string; items: T[] }[];
};

/**
 * Reparte os links pelos grupos, mantendo a ordem de entrada dentro de cada um e
 * omitindo os grupos vazios (um professor não vê «Administração»). Um destino que
 * ainda não está na tabela cai no último grupo: um link novo nunca desaparece do menu.
 */
export function groupLinks<T extends NavLinkBase>(links: T[]): NavLayout<T> {
  const top: T[] = [];
  const byGroup = new Map<NavGroupId, T[]>(NAV_GROUPS.map((g) => [g.id, []]));
  const fallback = NAV_GROUPS[NAV_GROUPS.length - 1].id;

  for (const link of links) {
    if (TOP.has(link.href)) {
      top.push(link);
      continue;
    }
    byGroup.get(GROUP_OF[link.href] ?? fallback)!.push(link);
  }

  return {
    top,
    groups: NAV_GROUPS.map((g) => ({ ...g, items: byGroup.get(g.id)! })).filter((g) => g.items.length > 0),
  };
}

/**
 * O destino a marcar como atual: o mais específico que contém o pathname. Sem isto,
 * `/professor/tutor` marcava também `/professor`, e `/` só se aceita por igualdade.
 */
export function activeHref(pathname: string, hrefs: string[]): string | null {
  let best: string | null = null;
  for (const href of hrefs) {
    const hit = href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
    if (hit && (best === null || href.length > best.length)) best = href;
  }
  return best;
}

export type Crumb = { label: string; href?: string };

/**
 * Início, lista e página atual, por esta ordem. A última não é ligação: é onde o utilizador já está.
 * Sem `parent` (a própria lista de um módulo) ficam só Início e a página atual.
 */
export function buildCrumbs(parent: { label: string; href: string } | null, current: string): Crumb[] {
  const home: Crumb = { label: 'Início', href: '/' };
  return parent ? [home, { label: parent.label, href: parent.href }, { label: current }] : [home, { label: current }];
}
