import 'server-only';

import { cache } from 'react';
import { apiGet, apiPut, type Result } from './api';
import { VISIBILITY_SCOPES, fromWireVisibility, toWireVisibility, type RankingVisibility, type RankingVisibilityScope, type VisibilityPreferences } from './ranking-rules';

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

/** Contrato do kixi#619: uma resposta com os três âmbitos, quer na leitura quer
 *  depois de uma escrita. `rankingVisibility` usa `out` onde o cliente diz `hidden`;
 *  a conversão vive em `ranking-rules.ts`, para não haver duas traduções. */
interface WirePreference {
  scope: string;
  rankingVisibility: string;
}
interface WirePreferences {
  preferences: WirePreference[];
}

function preferencesFromWire(data: WirePreferences): VisibilityPreferences {
  const stored = new Map(
    data.preferences.map((entry) => [entry.scope, fromWireVisibility(entry.rankingVisibility)]),
  );
  return Object.fromEntries(
    VISIBILITY_SCOPES.map((scope) => [scope, stored.get(scope) ?? 'visible']),
  ) as VisibilityPreferences;
}

/** GET /leaderboard/preferences: uma leitura devolve os três âmbitos. Sem linha,
 *  o backend responde `visible`, o comportamento que a tabela sempre teve. */
export async function readRankingPreferences(): Promise<Result<VisibilityPreferences>> {
  const result = await apiGet<WirePreferences>('/leaderboard/preferences');
  return result.ok ? { ok: true, data: preferencesFromWire(result.data) } : result;
}

/** PUT /leaderboard/preferences/{scope}: escreve só o âmbito pedido, sempre na
 *  conta da sessão. O backend devolve o estado completo depois de gravar. */
export async function setRankingVisibility(
  scope: RankingVisibilityScope,
  preference: RankingVisibility,
): Promise<Result<VisibilityPreferences>> {
  const result = await apiPut<WirePreferences>(
    `/leaderboard/preferences/${scope}`,
    { rankingVisibility: toWireVisibility(preference) },
  );
  return result.ok ? { ok: true, data: preferencesFromWire(result.data) } : result;
}

/** As três respostas do interruptor, numa leitura por pedido (#611). O global não
 *  entra: é o consentimento entre escolas, que tem o seu próprio endpoint. */
export const loadRankingVisibility = cache(readRankingPreferences);
