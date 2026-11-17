'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { loadRankingVisibilityAction, setRankingVisibilityAction } from '@/lib/ranking-actions';
import {
  VISIBILITY_SCOPES,
  showsNameInRanking,
  visibilityNote,
  type VisibilityPreferences,
} from '@/lib/ranking-rules';
import { cn } from '@/lib/utils';

/**
 * O interruptor «Aparecer no ranking» (#800), um só para a turma, a escola e os
 * amigos. O backend do #611 guarda uma resposta por âmbito; aqui ligar escreve
 * `visible` nos três e desligar escreve `anonymous` — a linha fica na tabela,
 * só o nome sai, que é o que a frase promete. Quem já vinha de outro cliente com
 * um estado `hidden` vê-o explicado, em vez de o interruptor mentir.
 *
 * Na Liga segue a maquete (título 26px, switch 88×52); no Perfil entra em modo
 * `compact` para não romper a escala das restantes definições.
 */
export function RankingVisibility({
  initial,
  compact = false,
  className,
}: {
  initial: VisibilityPreferences | null;
  compact?: boolean;
  className?: string;
}) {
  const [preferences, setPreferences] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const appearing = preferences ? showsNameInRanking(preferences) : false;
  const note = preferences
    ? visibilityNote(preferences)
    : 'Não foi possível ler a tua preferência de ranking.';
  const copy = (
    <>
      <span
        className={cn(
          'font-bold text-[#121c15]',
          compact ? 'text-base' : 'text-[26px] leading-tight',
        )}
      >
        Aparecer no ranking
      </span>
      <span
        id="ranking-visibility-note"
        className={cn(
          'font-normal text-[#6B6B6B]',
          compact ? 'text-[13px]' : 'text-xl leading-snug',
        )}
      >
        {note}
      </span>
    </>
  );

  function change(next: boolean) {
    if (!preferences) return;
    const before = preferences;
    const preference = next ? 'visible' : 'anonymous';
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
    <div className={cn('grid gap-1 py-4', compact && 'py-3.5', className)}>
      <div className="flex items-center justify-between gap-4">
        {preferences ? (
          <Label htmlFor="ranking-visibility" className="grid gap-1 leading-snug">
            {copy}
          </Label>
        ) : (
          // Sem preferência não há controlo para rotular: um <label for> sem
          // destino seria um rótulo órfão para quem lê o ecrã.
          <div className="grid gap-1 leading-snug">{copy}</div>
        )}
        {preferences ? (
          <Switch
            id="ranking-visibility"
            checked={appearing}
            disabled={pending}
            aria-describedby="ranking-visibility-note"
            onCheckedChange={change}
            className={cn(
              'border-0',
              !compact &&
                'h-[52px] w-[88px] bg-[#dde3da] data-[state=checked]:bg-[#1F5C2E]',
            )}
            thumbClassName={cn(
              !compact &&
                'size-11 bg-white shadow-sm data-[state=checked]:translate-x-[40px] data-[state=unchecked]:translate-x-1',
            )}
          />
        ) : (
          <Button type="button" variant="outline" size="sm" disabled={pending} onClick={retry}>
            Tentar de novo
          </Button>
        )}
      </div>
      {error && <p role="alert" className="text-[13px] text-destructive">{error}</p>}
      {/* Só `aria-live`: um segundo `role="status"` aqui daria dois nós ao selector
          do anúncio do ranking (#498), que também é um `role="status"`. */}
      <span className="sr-only" aria-live="polite">
        {pending ? 'A guardar a tua preferência de ranking.' : error ?? ''}
      </span>
    </div>
  );
}
