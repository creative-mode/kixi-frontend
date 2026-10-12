import 'server-only';

import { apiGet, type Result } from './api';

/** As três abas de GET /leaderboard. "friends" chega com o kixi#121 (PR #204,
 *  ainda em revisão) - até lá o backend responde 404 a este scope. */
export type RankingScope = 'class' | 'school' | 'friends';
export type RankingPeriod = 'all' | 'month';

/** Uma linha da janela que o backend devolve - nunca a tabela toda. `accountId`
 *  só vem preenchido na própria entrada do aluno; `displayName` já chega mascarado
 *  ("Primeiro U.") nas restantes. */
export interface RankingEntry {
  position: number;
  accountId: number | null;
  displayName: string;
  average: number | null;
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
  totalStudents: number;
  rankedStudents: number;
  smallGroup: boolean;
  myPosition: number | null;
  myAverage: number | null;
  entries: RankingEntry[];
}

export async function getLeaderboard(
  scope: RankingScope,
  period: RankingPeriod = 'all',
  statementId?: number,
): Promise<Result<Leaderboard>> {
  return apiGet<Leaderboard>('/leaderboard', { scope, period, statementId });
}
