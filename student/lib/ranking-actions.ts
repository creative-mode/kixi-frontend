'use server';

import { forgetVisitedPages } from './refresh';
import {
  getLeaderboard,
  loadRankingVisibility,
  readRankingPreferences,
  setCrossInstitutionConsent,
  setRankingVisibility,
  type Leaderboard,
  type RankingMetric,
  type RankingPeriod,
  type RankingScope,
} from './ranking';
import { syncRankingVisibility } from './ranking-visibility-sync';
import {
  type RankingVisibility,
  type VisibilityPreferences,
} from './ranking-rules';

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
  if (result.ok) forgetVisitedPages();
  return result.ok
    ? { ok: true, crossInstitution: result.data.crossInstitution }
    : { ok: false, message: result.message };
}

export type VisibilityResult =
  | { ok: true; preferences: VisibilityPreferences }
  | { ok: false; message: string; preferences: VisibilityPreferences | null };

/** O interruptor do #800 é um só, mas o #611 guarda uma resposta por âmbito:
 *  ligar escreve `visible` nos três, desligar escreve `anonymous` nos três (a
 *  linha fica, o nome sai — é o que a cópia promete). Em falha parcial, a
 *  releitura diz ao ecrã o que o servidor guardou realmente. */
export async function setRankingVisibilityAction(appear: boolean): Promise<VisibilityResult> {
  const preference: RankingVisibility = appear ? 'visible' : 'anonymous';
  const result = await syncRankingVisibility(
    (scope, value) => setRankingVisibility(scope, value),
    readRankingPreferences,
    preference,
  );
  // Mesmo uma falha parcial mudou o servidor: as páginas visitadas têm de ser
  // refrescadas para a próxima leitura não usar dados antigos.
  forgetVisitedPages();
  return result;
}

/** Releitura para o botão de tentar de novo quando a página abriu sem a preferência. */
export async function loadRankingVisibilityAction(): Promise<VisibilityResult> {
  const result = await loadRankingVisibility();
  return result.ok
    ? { ok: true, preferences: result.data }
    : { ok: false, message: result.message, preferences: null };
}
