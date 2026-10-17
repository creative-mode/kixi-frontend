'use server';

import {
  getLeaderboard,
  setCrossInstitutionConsent,
  type Leaderboard,
  type RankingMetric,
  type RankingPeriod,
  type RankingScope,
} from './ranking';

export type BoardResult =
  | { ok: true; data: Leaderboard }
  | { ok: false; message: string; status: number };

/** Ponte para o cliente mudar de aba sem um novo pedido de página. O `status` vai junto
 *  porque o scope global responde 403 a quem ainda não consentiu, e esse não é um erro:
 *  é a página a oferecer o interruptor. */
export async function fetchLeaderboardAction(
  scope: RankingScope,
  period: RankingPeriod = 'all',
  metric: RankingMetric = 'average',
): Promise<BoardResult> {
  const result = await getLeaderboard(scope, period, undefined, metric);
  return result.ok
    ? { ok: true, data: result.data }
    : { ok: false, message: result.message, status: result.status };
}

export async function setConsentAction(
  crossInstitution: boolean,
): Promise<{ ok: true; crossInstitution: boolean } | { ok: false; message: string }> {
  const result = await setCrossInstitutionConsent(crossInstitution);
  return result.ok
    ? { ok: true, crossInstitution: result.data.crossInstitution }
    : { ok: false, message: result.message };
}
