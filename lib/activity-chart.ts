/** Texto do gráfico de atividade, sem React nem formatação de datas: testável com `node --test`. */

export type ActivityUnit = 'dia' | 'semana';

const PLURAL: Record<ActivityUnit, string> = { dia: 'dias', semana: 'semanas' };

/** «12 simulações concluídas em 8 semanas». A unidade vem de quem desenha: a vista do professor é semanal. */
export function activitySummary(points: { finished: number }[], unit: ActivityUnit): string {
  const total = points.reduce((n, p) => n + p.finished, 0);
  const done = total === 1 ? '1 simulação concluída' : `${total} simulações concluídas`;
  const count = points.length;
  return `${done} em ${count} ${count === 1 ? unit : PLURAL[unit]}`;
}

/** O que se anuncia quando o foco chega a um ponto: período, concluídas e nota, sem depender da cor. */
export function describePoint(label: string, finished: number, score: string | null): string {
  const done = finished === 1 ? '1 simulação concluída' : `${finished} simulações concluídas`;
  return `${label}: ${done}, ${score ? `nota média ${score}` : 'sem nota média'}`;
}
