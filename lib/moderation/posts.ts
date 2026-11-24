// A fila de publicações denunciadas (S2): o contrato com o `PostController` do feed (`/feed/posts/reported`, `/hide`, `/unhide`)
// e as regras do ecrã, sem React nem servidor para o `node --test` chegar cá.
//
// Quem modera: o ADMIN (todas as escolas) e o professor (só as turmas em que dá aulas, decidido pelo servidor). Ocultar tira a
// publicação a toda a turma, incluindo ao autor; repor devolve-a. Nenhuma das duas pede nota nem escreve auditoria no backend.

export const REPORTED_POSTS_PATH = '/api/v1/feed/posts/reported';

/** `ReportedPostResponse` do backend, pela ordem do record. */
export const REPORTED_POST_KEYS = ['postId', 'authorAccountId', 'classId', 'content', 'isHidden', 'reportCount', 'createdAt'] as const;

export interface ReportedPost {
  postId: number;
  authorAccountId: number;
  classId: number;
  content: string;
  isHidden: boolean;
  reportCount: number;
  createdAt: string | null;
}

/** `PATCH /feed/posts/{id}/hide` ou `/unhide`: 204 sem corpo. */
export function postVisibilityPath(postId: number, hidden: boolean): string {
  return `/api/v1/feed/posts/${postId}/${hidden ? 'hide' : 'unhide'}`;
}

export const isPostId = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value > 0;

/** As mais denunciadas primeiro; a igualdade desfaz-se pela mais recente. */
export function byUrgency(posts: readonly ReportedPost[]): ReportedPost[] {
  return [...posts].sort((a, b) => b.reportCount - a.reportCount || (b.createdAt ?? '').localeCompare(a.createdAt ?? '') || b.postId - a.postId);
}

/** Por tratar (à vista na turma) e ocultas (já retiradas, podem repor-se). */
export function splitByVisibility(posts: readonly ReportedPost[]): { visiveis: ReportedPost[]; ocultas: ReportedPost[] } {
  const ordered = byUrgency(posts);
  return { visiveis: ordered.filter((p) => !p.isHidden), ocultas: ordered.filter((p) => p.isHidden) };
}

/** O texto da publicação cortado nas palavras, para a fila não ocupar o ecrã com uma publicação enorme. */
export function preview(content: string, max = 280): string {
  const clean = content.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const space = cut.lastIndexOf(' ');
  return `${(space > max / 2 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

export const denunciasLabel = (n: number): string => (n === 1 ? '1 denúncia' : `${n} denúncias`);
