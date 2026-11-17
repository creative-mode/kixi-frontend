import type { Leaderboard, RankingMetric, RankingPeriod, RankingScope } from './ranking';

/** Regras de apresentação do ranking (#117/#121/#31), sem servidor e sem React.
 *  As notas e as posições já vêm prontas do backend - isto só formata. */

export const SCOPE_LABEL: Record<RankingScope, string> = {
  class: 'Turma',
  school: 'Escola',
  friends: 'Amigos',
  global: 'Global',
};

/** Os âmbitos em que o aluno escolhe como aparece (#611). O global fica de fora:
 *  esse é o consentimento entre escolas (ADR-0013), não uma preferência de nome. */
export type RankingVisibilityScope = Exclude<RankingScope, 'global'>;
export type RankingVisibility = 'visible' | 'anonymous' | 'hidden';
export type VisibilityPreferences = Record<RankingVisibilityScope, RankingVisibility>;

export const VISIBILITY_SCOPES: readonly RankingVisibilityScope[] = ['class', 'school', 'friends'];

/** O interruptor está ligado quando o aluno aparece com o nome em todos os
 *  âmbitos. Desligado, a linha fica mas o nome sai; só um estado `hidden` (vindo
 *  de outro cliente) o tira da tabela por completo. */
export function showsNameInRanking(preferences: VisibilityPreferences): boolean {
  return VISIBILITY_SCOPES.every((scope) => preferences[scope] === 'visible');
}

/** O que os colegas veem, por palavras (#800). O interruptor é um só e desligar
 *  escreve `anonymous`: a frase explica isso mesmo. Um estado `hidden` vindo de
 *  outro cliente é dito como é, em vez de o interruptor mentir. */
export function visibilityNote(preferences: VisibilityPreferences): string {
  const hidden = VISIBILITY_SCOPES.filter((scope) => preferences[scope] === 'hidden');

  if (hidden.length === VISIBILITY_SCOPES.length) {
    return 'Os colegas não te veem no ranking. Continuas a ver a tua posição e a tua média.';
  }
  if (hidden.length > 0) {
    return 'Apareces em alguns rankings e não em outros. Liga para apareceres com o teu nome em todos, ou desliga para ficares como «Um colega».';
  }
  return 'Desligado, os colegas veem «Um colega».';
}

/** Onde o aluno está na tabela, dito sem nomear o fundo (#800): topo, meio, ou
 *  nada. A posição já é do backend; isto só a traduz numa faixa. */
export function relativeBandLabel(myPosition: number | null, totalStudents: number): string | null {
  if (myPosition == null || myPosition <= 0 || totalStudents <= 0) return null;
  const ratio = myPosition / totalStudents;
  if (ratio <= 0.3) return 'Estás entre os 30% melhores.';
  if (ratio <= 0.7) return 'Estás entre os 40% do meio.';
  return null;
}

/** Quanto falta para subir um lugar (#800), a partir da janela que o backend
 *  devolveu. Sem a linha de cima à vista, ou sem nota dos dois lados, devolve
 *  null: é melhor não dizer nada do que inventar uma distância. */
export function nextPlaceGap(board: Leaderboard, metric: RankingMetric): string | null {
  const mine = board.entries.find((entry) => entry.me);
  if (!mine || mine.position <= 1) return null;

  const above = board.entries
    .filter((entry) => entry.position < mine.position)
    .sort((a, b) => b.position - a.position)[0];
  if (!above) return null;

  if (board.scope === 'global') {
    if (board.myPercentile == null || above.percentile == null) return null;
    const gap = above.percentile - board.myPercentile;
    return gap > 0 ? `Faltam ${formatAverage(gap)} pontos percentuais para subires um lugar.` : null;
  }

  if (metric === 'xp') {
    if (mine.xp == null || above.xp == null) return null;
    const gap = above.xp - mine.xp;
    return gap > 0 ? `Faltam ${gap} XP para subires um lugar.` : null;
  }

  if (mine.average == null || above.average == null) return null;
  const gap = above.average - mine.average;
  return gap > 0 ? `Faltam ${formatAverage(gap)} pontos para subires um lugar.` : null;
}

export function formatAverage(value: number | null): string {
  return value == null ? '—' : value.toLocaleString('pt-PT', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

/** "5.º de 28" - null quando o aluno ainda não tem nota rankeável (myPosition null),
 *  porque "5.º" sem nota própria seria inventado. */
export function myPositionLabel(myPosition: number | null, totalStudents: number): string | null {
  if (myPosition == null) return null;
  return `${myPosition}.º de ${totalStudents}`;
}

/** Progresso até ao pódio, apenas quando o backend forneceu as duas pontuações. */
export function podiumGap(board: Leaderboard, metric: RankingMetric): string | null {
  if (board.myPosition == null || board.myPosition <= 3) return null;
  const third = board.entries.find((entry) => entry.position === 3);
  if (!third) return null;

  if (metric === 'xp') {
    const mine = board.entries.find((entry) => entry.me)?.xp;
    if (mine == null || third.xp == null || third.xp <= mine) return null;
    return `A ${third.xp - mine} XP do 3.º lugar`;
  }

  if (board.myAverage == null || third.average == null || third.average <= board.myAverage) return null;
  return `A ${formatAverage(third.average - board.myAverage)} pontos do 3.º lugar`;
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
