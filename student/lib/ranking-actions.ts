'use server';

import { getLeaderboard, type Leaderboard, type RankingPeriod, type RankingScope } from './ranking';

/** Ponte para o cliente mudar de aba sem um novo pedido de página - o scope
 *  "friends" nem chega aqui (components/ranking-view.tsx mostra um estado fixo,
 *  sem pedir ao backend algo que ainda dá 404 - kixi#121). */
export async function fetchLeaderboardAction(
  scope: RankingScope,
  period: RankingPeriod = 'all',
): Promise<{ ok: true; data: Leaderboard } | { ok: false; message: string }> {
  const result = await getLeaderboard(scope, period);
  return result.ok ? { ok: true, data: result.data } : { ok: false, message: result.message };
}
