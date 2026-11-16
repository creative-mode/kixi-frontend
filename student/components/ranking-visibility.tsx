'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { loadRankingVisibilityAction, setRankingVisibilityAction } from '@/lib/ranking-actions';
import {
  VISIBILITY_SCOPES,
  appearsInRanking,
  visibilityNote,
  type VisibilityPreferences,
} from '@/lib/ranking-rules';
import { cn } from '@/lib/utils';

/**
 * O interruptor «Aparecer no ranking» (#800), um só para a turma, a escola e os
 * amigos. O backend do #611 guarda uma resposta por âmbito; aqui ligar escreve
 * `visible` nos três e desligar escreve `hidden`, e a frase diz o que os colegas
 * veem em cada estado. Quem já vinha de outro cliente com um estado anónimo vê-o
 * explicado, em vez de o interruptor mentir.
 */
export function RankingVisibility({
  initial,
  className,
}: {
  initial: VisibilityPreferences | null;
  className?: string;
}) {
  const [preferences, setPreferences] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const appearing = preferences ? appearsInRanking(preferences) : false;
  const note = preferences
    ? visibilityNote(preferences)
    : 'Não foi possível ler a tua preferência de ranking.';
  const copy = (
    <>
      <span className="text-base">Aparecer no ranking</span>
      <span id="ranking-visibility-note" className="text-[13px] font-normal text-muted-foreground">
        {note}
      </span>
    </>
  );

  function change(next: boolean) {
    if (!preferences) return;
    const before = preferences;
    const preference = next ? 'visible' : 'hidden';
    setPreferences(
      Object.fromEntries(
        VISIBILITY_SCOPES.map((scope) => [scope, preference]),
      ) as VisibilityPreferences,
    );
    setError(null);
    start(async () => {
      const result = await setRankingVisibilityAction(next);
      if (result.ok) {
        setPreferences(result.preferences);
      } else {
        setPreferences(before);
        setError(result.message);
      }
    });
  }

  function retry() {
    setError(null);
    start(async () => {
      const result = await loadRankingVisibilityAction();
      if (result.ok) setPreferences(result.preferences);
      else setError(result.message);
    });
  }

  return (
    <div className={cn('grid gap-1 py-3.5', className)}>
      <div className="flex items-start justify-between gap-4">
        {preferences ? (
          <Label htmlFor="ranking-visibility" className="grid gap-0.5 leading-snug">
            {copy}
          </Label>
        ) : (
          // Sem preferência não há controlo para rotular: um <label for> sem
          // destino seria um rótulo órfão para quem lê o ecrã.
          <div className="grid gap-0.5 leading-snug">{copy}</div>
        )}
        {preferences ? (
          <Switch
            id="ranking-visibility"
            checked={appearing}
            disabled={pending}
            aria-describedby="ranking-visibility-note"
            onCheckedChange={change}
          />
        ) : (
          <Button type="button" variant="outline" size="sm" disabled={pending} onClick={retry}>
            Tentar de novo
          </Button>
        )}
      </div>
      {error && <p role="alert" className="text-[13px] text-destructive">{error}</p>}
      <span className="sr-only" role="status" aria-live="polite">
        {pending ? 'A guardar a tua preferência de ranking.' : error ?? ''}
      </span>
    </div>
  );
}
