/** «Montar treino» (kixi#729) no mock: que questões de um enunciado entram num treino de N. */

/**
 * As folhas do enunciado (sem os cabeçalhos de grupo, que o aluno não responde), limitadas a `count`. Sem limite
 * útil (N chega para a prova toda) devolve `undefined`: a simulação usa o enunciado inteiro, como no backend.
 */
export function practiceQuestionIds(paper: number[], parentIds: ReadonlySet<number>, count: number): number[] | undefined {
  const leaves = paper.filter((id) => !parentIds.has(id));
  return count < leaves.length ? leaves.slice(0, count) : undefined;
}
