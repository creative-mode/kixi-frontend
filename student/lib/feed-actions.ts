'use server';

import { revalidatePath } from 'next/cache';
import { createPost, createSimulationPost, addComment, reportPost, toggleReaction, type PostType } from './feed';
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

export async function addCommentAction(postId: number, content: string): Promise<{ ok: boolean }> {
  if (!content.trim()) return { ok: false };
  const result = await addComment(postId, content.trim());
  if (!result.ok) return { ok: false };
  revalidatePath('/inicio');
  return { ok: true };
}

export async function reportPostAction(postId: number, reason: string): Promise<{ ok: boolean }> {
  if (!reason.trim()) return { ok: false };
  const result = await reportPost(postId, reason.trim());
  return { ok: result.ok };
}
