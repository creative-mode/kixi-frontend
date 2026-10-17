import 'server-only';

import { apiGet, apiPut, type Result } from './api';

/** As abas de GET /leaderboard. "global" cruza escolas e só existe com o consentimento do
 *  aluno (ADR-0013): sem ele o backend responde 403, e a página oferece o interruptor. */
export type RankingScope = 'class' | 'school' | 'friends' | 'global';
export type RankingPeriod = 'all' | 'month';
/** O que ordena a tabela: a média das provas (no global, o percentil na própria escola) ou o XP acumulado. */
export type RankingMetric = 'average' | 'xp';

/** Uma linha da janela que o backend devolve - nunca a tabela toda. `accountId`
 *  só vem preenchido na própria entrada do aluno; `displayName` já chega mascarado
 *  ("Primeiro U.") nas restantes. */
export interface RankingEntry {
  position: number;
  accountId: number | null;
  displayName: string;
  average: number | null;
  /** XP acumulado; só vem preenchido com `metric=xp`. */
  xp?: number | null;
  /** Só no scope global: a posição relativa dentro da própria escola (0-100). */
  percentile?: number | null;
  me: boolean;
}

/** LeaderboardResponse. `entries` é só pódio + vizinhos do aluno - o backend já
 *  decide a janela e esconde os últimos lugares em grupos pequenos
 *  (`smallGroup`); o cliente não recalcula nada disto. */
export interface Leaderboard {
  scope: RankingScope;
  groupId: number | null;
  statementId: number | null;
  period: RankingPeriod;
  metric?: RankingMetric;
  totalStudents: number;
  rankedStudents: number;
  institutionsCounted?: number;
  smallGroup: boolean;
  myPosition: number | null;
  myAverage: number | null;
  myPercentile?: number | null;
  entries: RankingEntry[];
}

export async function getLeaderboard(
  scope: RankingScope,
  period: RankingPeriod = 'all',
  statementId?: number,
  metric: RankingMetric = 'average',
): Promise<Result<Leaderboard>> {
  return apiGet<Leaderboard>('/leaderboard', { scope, period, statementId, metric });
}

/** PUT /leaderboard/consent: aceitar ou retirar o ranking entre escolas. */
export async function setCrossInstitutionConsent(crossInstitution: boolean): Promise<Result<{ crossInstitution: boolean }>> {
  return apiPut<{ crossInstitution: boolean }>('/leaderboard/consent', { crossInstitution });
}
