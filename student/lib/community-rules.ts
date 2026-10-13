/** Regras de apresentação da comunidade de uma prova (#119/#32), sem servidor e
 *  sem React. Tudo o que é número já vem do backend (CommunityStatsResponse);
 *  isto só formata, nunca recalcula uma nota ou uma percentagem. */

/** "Tu: 16,4 · Média: 12,8 (+3,6)" - null quando falta a nota do aluno ou a média da
 *  comunidade, porque a comparação não existe sem as duas. */
export function compareToAverage(mine: number | null, mean: number | null): string | null {
  if (mine == null || mean == null) return null;
  const delta = mine - mean;
  const sign = delta > 0 ? '+' : '';
  return `Tu: ${formatScore(mine)} · Média: ${formatScore(mean)} (${sign}${formatScore(delta)})`;
}

export function formatScore(value: number): string {
  return value.toLocaleString('pt-PT', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

/** 0-100, ou null quando a pergunta ainda não tem nenhuma tentativa avaliada - uma
 *  barra a 0% diria "todos erraram", que não é a mesma coisa que "ninguém respondeu
 *  ainda a esta pergunta". */
export function pctCorrectLabel(pctCorrect: number | null): string {
  return pctCorrect == null ? 'Sem dados' : `${Math.round(pctCorrect)}% acertou`;
}

/** Rótulo de um intervalo do histograma de notas. `to` null quer dizer "e acima". */
export function bucketLabel(from: number | null, to: number | null): string {
  if (from == null) return `até ${to}`;
  if (to == null) return `${from}+`;
  return `${from}–${to}`;
}
