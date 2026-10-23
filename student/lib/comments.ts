import 'server-only';

import { getComments, type PostComment } from './feed';
import { loadPhotos } from './photos';
import { safePhoto } from './profile';

/**
 * A conversa de uma publicação, com a foto de cada autor.
 *
 * O backend já traz a foto com o comentário (chave `authorPhoto`, mesmo a null): não há pedidos de perfil. Só um backend
 * antigo, que não traz a chave, obriga a ir buscar uma foto por pessoa ao perfil. Partilhada entre a ação que o painel chama
 * ao abrir e o início, que lê já as primeiras conversas no servidor para o painel abrir sem esperar pela rede.
 */
export async function readConversation(postId: number, page = 1, limit = 20): Promise<{ ok: true; comments: PostComment[] } | { ok: false; message: string }> {
  const result = await getComments(postId, page, limit);
  if (!result.ok) return { ok: false, message: result.message };
  const withPhoto = result.data.every((c) => 'authorPhoto' in c);
  const photos = withPhoto ? {} : await loadPhotos(result.data.filter((c) => !c.mine).map((c) => c.authorAccountId)).catch(() => ({}) as Record<number, string>);
  return {
    ok: true,
    comments: result.data.map((c) => ({ ...c, photo: c.mine ? null : withPhoto ? (safePhoto(c.authorPhoto) ?? null) : (photos[c.authorAccountId] ?? null) })),
  };
}

/** Quantas publicações do início já chegam com a conversa dentro: as que se vêem sem rolar. */
export const FIRST_CONVERSATIONS = 4;

/** As conversas das primeiras publicações com comentários, lidas em paralelo; uma que falhe fica de fora (abre-se ao tocar). */
export async function loadFirstConversations(posts: Array<{ id: number; commentCount: number }>): Promise<Record<number, PostComment[]>> {
  const wanted = posts.filter((p) => p.commentCount > 0).slice(0, FIRST_CONVERSATIONS);
  const read = await Promise.all(wanted.map(async (p) => [p.id, await readConversation(p.id).catch(() => null)] as const));
  return Object.fromEntries(read.filter((r): r is readonly [number, { ok: true; comments: PostComment[] }] => !!r[1]?.ok).map(([id, r]) => [id, r.comments]));
}
