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

/** O interruptor responde a «apareço?»: fica ligado enquanto o aluno não estiver
 *  fora de todos os âmbitos. Um estado anónimo ainda conta como aparecer. */
export function appearsInRanking(preferences: VisibilityPreferences): boolean {
  return VISIBILITY_SCOPES.some((scope) => preferences[scope] !== 'hidden');
}

/** O que os colegas veem, por palavras (#800). O interruptor é um só, mas o
 *  backend guarda três respostas: a frase tem de ser honesta quando divergem. */
export function visibilityNote(preferences: VisibilityPreferences): string {
  const hidden = VISIBILITY_SCOPES.filter((scope) => preferences[scope] === 'hidden');
  const anonymous = VISIBILITY_SCOPES.filter((scope) => preferences[scope] === 'anonymous');

  if (hidden.length === VISIBILITY_SCOPES.length) {
    return 'Os colegas não te veem no ranking. Continuas a ver a tua posição e a tua média.';
  }
  if (hidden.length > 0) {
    return 'Apareces em alguns rankings e não em outros. Liga para apareceres com o teu nome em todos, ou desliga para saíres de todos.';
  }
  if (anonymous.length === VISIBILITY_SCOPES.length) {
    return 'Os colegas veem «Um colega» no teu lugar. A posição mantém-se; só o nome desaparece.';
  }
  if (anonymous.length > 0) {
    return 'Num dos rankings apareces como «Um colega»; nos restantes, com o nome abreviado.';
  }
  return 'Os colegas veem o teu nome abreviado — primeiro nome e inicial do apelido — na turma, na escola e entre amigos.';
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
