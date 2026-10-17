'use server';

import { revalidatePath } from 'next/cache';
import { loadPhotos } from './photos';
import { createPost, createSimulationPost, addComment, getComments, reportPost, toggleReaction, type PostComment, type PostType } from './feed';
import { canPublish, canPublishReflection } from './feed-rules';

export type FeedActionState = { error?: string } | undefined;

/** Publica uma dúvida ou tema na turma do aluno. Chamado directamente do formulário
 *  do compositor (components/inicio/*), sem useActionState: o próprio componente
 *  mantém o texto em estado local e só o limpa depois de um `{ ok: true }`. */
export async function publishPostAction(
  classId: number,
  type: PostType,
  content: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!canPublish(content)) {
    return { ok: false, message: 'Escreve pelo menos 5 caracteres.' };
  }
  const result = await createPost(classId, type, content.trim());
  if (!result.ok) return { ok: false, message: result.message };
  revalidatePath('/inicio');
  return { ok: true };
}

/** Publica o resultado de uma simulação como cartão da escola, com uma reflexão opcional.
 *  Os números vêm do servidor: o cliente só diz que tentativa e o que pensa dela. */
export async function publishSimulationAction(
  classId: number,
  simulationId: number,
  reflection: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!canPublishReflection(reflection)) {
    return { ok: false, message: 'A reflexão tem no máximo 2000 caracteres.' };
  }
  const result = await createSimulationPost(classId, simulationId, reflection.trim());
  if (!result.ok) {
    return {
      ok: false,
      message: result.status === 409
        ? 'Este resultado já foi publicado no feed.'
        : result.message,
    };
  }
  revalidatePath('/inicio');
  return { ok: true };
}

export async function toggleReactionAction(postId: number): Promise<{ ok: boolean; reacted?: boolean }> {
  const result = await toggleReaction(postId);
  if (!result.ok) return { ok: false };
  revalidatePath('/inicio');
  return { ok: true, reacted: result.data.reacted };
}

export async function addCommentAction(
  postId: number,
  content: string,
): Promise<{ ok: true; comment: PostComment } | { ok: false; message: string }> {
  if (!content.trim()) return { ok: false, message: 'Escreve o comentário.' };
  if (content.trim().length > 500) return { ok: false, message: 'O comentário tem no máximo 500 caracteres.' };
  const result = await addComment(postId, content.trim());
  if (!result.ok) {
    return { ok: false, message: result.status === 429 ? 'Estás a comentar depressa demais. Espera um minuto e tenta de novo.' : result.message };
  }
  revalidatePath('/inicio');
  return { ok: true, comment: result.data };
}

/** Lê a conversa de uma publicação. Não faz `revalidatePath`: um GET não muda nada do
 *  servidor, e revalidar aqui só custaria uma segunda leitura da página. */
export async function getCommentsAction(
  postId: number,
  page = 1,
  limit = 20,
): Promise<{ ok: true; comments: PostComment[] } | { ok: false; message: string }> {
  const result = await getComments(postId, page, limit);
  if (!result.ok) return { ok: false, message: result.message };
  const photos = await loadPhotos(result.data.filter((c) => !c.mine).map((c) => c.authorAccountId)).catch(() => ({}) as Record<number, string>);
  return { ok: true, comments: result.data.map((c) => ({ ...c, photo: c.mine ? null : (photos[c.authorAccountId] ?? null) })) };
}

export async function reportPostAction(postId: number, reason: string): Promise<{ ok: boolean }> {
  if (!reason.trim()) return { ok: false };
  const result = await reportPost(postId, reason.trim());
  return { ok: result.ok };
}
