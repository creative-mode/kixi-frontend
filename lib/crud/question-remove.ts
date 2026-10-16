/**
 * Remoção de um bloco (questão + alíneas) em que cada DELETE é uma chamada
 * própria: se uma falhar a meio, as anteriores já estão no servidor e não há
 * como as desfazer sem um endpoint de bloco. A regra é então não mentir: quem
 * chama recebe o que saiu e o que falhou, e mostra erro em vez de sucesso.
 */

export type BlockRemoveResult =
  | { ok: true; removed: number[] }
  | { ok: false; removed: number[]; failedId: number; error: string };

/** Remove por ordem, parando na primeira falha. Nunca devolve sucesso parcial. */
export async function removeQuestionBlock(
  ids: number[],
  remove: (id: number) => Promise<{ ok: boolean; error?: string }>,
): Promise<BlockRemoveResult> {
  const removed: number[] = [];
  for (const targetId of ids) {
    const res = await remove(targetId);
    if (!res.ok) {
      return { ok: false, removed, failedId: targetId, error: res.error ?? 'Não foi possível remover.' };
    }
    removed.push(targetId);
  }
  return { ok: true, removed };
}
