import { VISIBILITY_SCOPES, type RankingVisibility, type RankingVisibilityScope, type VisibilityPreferences } from './ranking-rules.ts';

/** A sincronização dos três âmbitos, isolada do servidor para a falha parcial
 *  poder ser testada com escritas e leituras falsas (kixi#619, revisão do #812). */

export type PreferenceResult =
  | { ok: true; data: VisibilityPreferences }
  | { ok: false; message: string };

export type VisibilityWriter = (scope: RankingVisibilityScope, value: RankingVisibility) => Promise<PreferenceResult>;
export type VisibilityReader = () => Promise<PreferenceResult>;

export type VisibilitySyncResult =
  | { ok: true; preferences: VisibilityPreferences }
  | { ok: false; message: string; preferences: VisibilityPreferences | null };

/** Escreve o mesmo valor nos três âmbitos. Se alguma escrita falha, o ecrã não
 *  pode ficar com o valor otimista: relê o servidor e devolve o estado real.
 *  Só quando nem a releitura funciona é que o chamador mantém o valor anterior,
 *  acompanhado de uma mensagem que diz isso. */
export async function syncRankingVisibility(
  write: VisibilityWriter,
  read: VisibilityReader,
  value: RankingVisibility,
): Promise<VisibilitySyncResult> {
  const results = await Promise.all(VISIBILITY_SCOPES.map((scope) => write(scope, value)));
  const failed = results.find((result) => !result.ok);

  if (!failed) {
    return {
      ok: true,
      preferences: Object.fromEntries(VISIBILITY_SCOPES.map((scope) => [scope, value])) as VisibilityPreferences,
    };
  }

  const current = await read();
  if (!current.ok) {
    return {
      ok: false,
      message: `${failed.message} Não foi possível confirmar o estado guardado.`,
      preferences: null,
    };
  }
  return {
    ok: false,
    message: `${failed.message} Mostramos o estado que o servidor guardou.`,
    preferences: current.data,
  };
}
