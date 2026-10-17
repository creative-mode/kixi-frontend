import type { RankingMetric, RankingPeriod, RankingScope } from './ranking';

/** Regras de apresentação do ranking (#117/#121/#31), sem servidor e sem React.
 *  As notas e as posições já vêm prontas do backend - isto só formata. */

export const SCOPE_LABEL: Record<RankingScope, string> = {
  class: 'Turma',
  school: 'Escola',
  friends: 'Amigos',
  global: 'Global',
};

export function formatAverage(value: number | null): string {
  return value == null ? '—' : value.toLocaleString('pt-PT', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

/** "5.º de 28" - null quando o aluno ainda não tem nota rankeável (myPosition null),
 *  porque "5.º" sem nota própria seria inventado. */
export function myPositionLabel(myPosition: number | null, totalStudents: number): string | null {
  if (myPosition == null) return null;
  return `${myPosition}.º de ${totalStudents}`;
}

/** A regra de grupo pequeno (#117) esconde o pódio e corta as últimas posições:
 *  quando isso acontece, a lista de `entries` é só os vizinhos do aluno, nunca
 *  a turma toda - esta frase explica o porquê em vez de deixar parecer incompleta. */
export function smallGroupNote(smallGroup: boolean): string | null {
  return smallGroup
    ? 'Este grupo é pequeno: por isso só mostramos quem está perto de ti, sem revelar os últimos lugares.'
    : null;
}

export const PERIOD_LABEL: Record<RankingPeriod, string> = { all: 'Desde sempre', month: 'Últimos 30 dias' };
export const METRIC_LABEL: Record<RankingMetric, string> = { average: 'Média das provas', xp: 'XP acumulado' };

/** O ranking global compara percentis dentro de cada escola, não notas: sem isto, uma prova fácil
 *  noutra escola passava por melhor desempenho. A frase diz de onde vem o lugar do aluno (ADR-0013). */
export function globalNote(institutionsCounted: number | undefined, metric: RankingMetric): string {
  const origin = institutionsCounted && institutionsCounted > 0
    ? `Comparado com alunos de ${institutionsCounted} ${institutionsCounted === 1 ? 'escola' : 'escolas'}`
    : 'Ainda não há escolas suficientes para comparar';
  return metric === 'xp'
    ? `${origin}, pelo XP acumulado. Os outros alunos aparecem sem nome nem escola.`
    : `${origin}. Cada aluno conta pelo percentil dentro da própria escola, não pela nota bruta, porque as provas mudam de escola para escola. Os outros alunos aparecem sem nome nem escola.`;
}

/** Uma escola só entra no ranking global com alunos suficientes, para ninguém ser identificável. */
export const GLOBAL_EMPTY_HINT =
  'O ranking global só mostra escolas com pelo menos 10 alunos com nota e consentimento. Aparece aqui quando houver.';
