/** A conversa de uma publicação em modo de demonstração (#179), sem servidor e sem
 *  React - o mesmo corte que `exam-rooms.ts` faz com as salas de prova, para o mock
 *  saber o que responder sem carregar o `backend.ts` inteiro num teste. */

export type MockPostComment = {
  id: number;
  postId: number;
  authorAccountId: number;
  content: string;
  isHidden: boolean;
  createdAt: string;
  updatedAt: string;
};

/** O que o painel recebe de cada linha: o `displayName` já mascarado e `mine`, como o
 *  backend resolve antes de responder. */
export type CommentRow = MockPostComment & {
  mine: boolean;
  displayName: string | null;
};

export type CommentError = { ok: false; status: number; message: string };

/**
 * Uma página da conversa, do mais antigo para o mais novo.
 *
 * <p>O âmbito vem das turmas do aluno e não de um id no URL: um post de outra turma é
 * 404 e não uma lista vazia, porque um vazio diria que não há nada escrito ali.</p>
 */
export function conversation(
  comments: MockPostComment[],
  postVisible: boolean,
  accountId: number,
  maskedNameOf: (id: number) => string | null,
  page = 1,
  limit = 20,
): CommentRow[] | CommentError {
  if (page < 1) return { ok: false, status: 400, message: 'page must be at least 1' };
  if (limit < 1 || limit > 100) return { ok: false, status: 400, message: 'limit must be between 1 and 100' };
  if (!postVisible) return { ok: false, status: 404, message: 'Post not found' };

  const visible = comments
    .filter((c) => !c.isHidden)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id - b.id)
    .slice((page - 1) * limit, page * limit);

  return visible.map((c) => ({
    ...c,
    mine: c.authorAccountId === accountId,
    displayName: maskedNameOf(c.authorAccountId),
  }));
}
