import 'server-only';

import { getComments, type PostComment } from './feed';
import { loadPhotos } from './photos';
import { safePhoto } from './profile';

/**
 * A conversa de uma publicação, com a foto de cada autor.
 *
 * O backend já traz a foto com o comentário (chave `authorPhoto`, mesmo a null): não há pedidos de perfil. Só um backend
 * antigo, que não traz a chave, obriga a ir buscar uma foto por pessoa ao perfil. Usada pela ação que o painel chama
 * ao abrir ou antecipar a conversa por intenção explícita.
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
