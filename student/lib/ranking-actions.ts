'use server';

import { forgetVisitedPages } from './refresh';
import {
  getLeaderboard,
  loadRankingVisibility,
  setCrossInstitutionConsent,
  setRankingVisibility,
  type Leaderboard,
  type RankingMetric,
  type RankingPeriod,
  type RankingScope,
} from './ranking';
import {
  VISIBILITY_SCOPES,
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
  | { ok: false; message: string };

/** O interruptor do #800 é um só, mas o #611 guarda uma resposta por âmbito: ligar
 *  escreve `visible` nos três, desligar escreve `hidden` nos três. Só devolve
 *  sucesso quando as três escritas landaram — uma preferência meio escrita não
 *  pode aparecer como escolhida. */
export async function setRankingVisibilityAction(appear: boolean): Promise<VisibilityResult> {
  const preference: RankingVisibility = appear ? 'visible' : 'hidden';
  const results = await Promise.all(
    VISIBILITY_SCOPES.map((scope) => setRankingVisibility(scope, preference)),
  );
  const failed = results.find((result) => !result.ok);
  if (failed && !failed.ok) return { ok: false, message: failed.message };

  forgetVisitedPages();
  return {
    ok: true,
    preferences: Object.fromEntries(
      VISIBILITY_SCOPES.map((scope) => [scope, preference]),
    ) as VisibilityPreferences,
  };
}

/** Releitura para o botão de tentar de novo quando a página abriu sem a preferência. */
export async function loadRankingVisibilityAction(): Promise<VisibilityResult> {
  const result = await loadRankingVisibility();
  return result.ok
    ? { ok: true, preferences: result.data }
    : { ok: false, message: result.message };
}
