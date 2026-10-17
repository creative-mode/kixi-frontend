/** Quantas questões respondíveis tem uma prova: as que não são o enunciado comum de umas alíneas. */
export function countLeafQuestions(ids: number[], parentIds: Array<number | null | undefined>): number {
  const parents = new Set(parentIds.filter((p): p is number => p != null));
  return ids.filter((id) => !parents.has(id)).length;
}
