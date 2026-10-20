'use server';

import { revalidatePath } from 'next/cache';
import { readConversation } from './comments';
import { BACKEND } from './session';
import { authHeaders, problem } from './api';
import { MOCK } from './mock/backend';
import { payloadOf, problemOf, type BlockDraft, type BuiltKind } from './post-blocks';
import { createBuiltPost, createPost, createSimulationPost, addComment, getComments, reportPost, toggleReaction, type PostComment, type PostType } from './feed';
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
  // Sem `revalidatePath`: o cartão já mostra o resultado, e recarregar o início custava as 15 leituras da página (#393).
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
  // Idem: a linha nova entra na lista do cartão e a contagem sobe lá; o início não precisa de se recarregar (#393).
  return { ok: true, comment: result.data };
}

/** Lê a conversa de uma publicação. Não faz `revalidatePath`: um GET não muda nada do
 *  servidor, e revalidar aqui só custaria uma segunda leitura da página. */
export async function getCommentsAction(
  postId: number,
  page = 1,
  limit = 20,
): Promise<{ ok: true; comments: PostComment[] } | { ok: false; message: string }> {
  return readConversation(postId, page, limit);
}

export async function reportPostAction(postId: number, reason: string): Promise<{ ok: boolean }> {
  if (!reason.trim()) return { ok: false };
  const result = await reportPost(postId, reason.trim());
  return { ok: result.ok };
}

/** Publica uma publicação construída. As regras repetem-se aqui para o servidor não depender do cliente. */
export async function publishBuiltPostAction(
  classId: number,
  kind: BuiltKind,
  title: string,
  drafts: BlockDraft[],
): Promise<{ ok: true } | { ok: false; message: string }> {
  const blocks = payloadOf(drafts);
  const invalid = problemOf(kind, title, blocks);
  if (invalid) return { ok: false, message: invalid };
  const result = await createBuiltPost(classId, kind, blocks, title.trim());
  if (!result.ok) {
    return { ok: false, message: result.status === 429 ? 'Estás a publicar depressa demais. Espera um minuto e tenta de novo.' : result.message };
  }
  revalidatePath('/inicio');
  return { ok: true };
}

/** Envia uma imagem para uma publicação e devolve o endereço a guardar no bloco. */
export async function enviarImagemPostAction(form: FormData): Promise<{ url?: string; error?: string }> {
  const file = form.get('file');
  if (!(file instanceof File) || file.size === 0) return { error: 'Escolhe uma imagem.' };
  if (!file.type.startsWith('image/')) return { error: 'O ficheiro tem de ser uma imagem (PNG, JPG ou WEBP).' };
  if (file.size > 2 * 1024 * 1024) return { error: 'A imagem deve ter no máximo 2 MB.' };
  // Sem backend (modo de demonstração) não há onde guardar o ficheiro: devolve um endereço do mesmo formato.
  if (MOCK) return { url: `/uploads/images/post/demo-${Date.now()}.png` };
  const out = new FormData();
  out.append('file', file, file.name);
  try {
    const res = await fetch(`${BACKEND}/images?kind=post`, { method: 'POST', headers: await authHeaders(), body: out, cache: 'no-store' });
    if (!res.ok) return { error: (await problem(res)).message };
    const body = (await res.json()) as { url?: string };
    return body.url ? { url: body.url } : { error: 'O servidor não devolveu a imagem.' };
  } catch {
    return { error: 'Não foi possível enviar a imagem agora. Tenta outra vez.' };
  }
}
