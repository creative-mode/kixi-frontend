import 'server-only';

import { apiGet, apiPut, type Result } from './api';

/** As abas de GET /leaderboard. "global" cruza escolas e só existe com o consentimento do
 *  aluno (ADR-0013): sem ele o backend responde 403, e a página oferece o interruptor. */
export type RankingScope = 'class' | 'school' | 'friends' | 'global';
export type RankingPeriod = 'all' | 'month';

/** Uma linha da janela que o backend devolve - nunca a tabela toda. `accountId`
 *  só vem preenchido na própria entrada do aluno; `displayName` já chega mascarado
 *  ("Primeiro U.") nas restantes. */
export interface RankingEntry {
  position: number;
  accountId: number | null;
  displayName: string;
  average: number | null;
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
): Promise<Result<Leaderboard>> {
  return apiGet<Leaderboard>('/leaderboard', { scope, period, statementId });
}

/** PUT /leaderboard/consent: aceitar ou retirar o ranking entre escolas. */
export async function setCrossInstitutionConsent(crossInstitution: boolean): Promise<Result<{ crossInstitution: boolean }>> {
  return apiPut<{ crossInstitution: boolean }>('/leaderboard/consent', { crossInstitution });
}
