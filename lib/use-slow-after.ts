'use client';

import { useEffect, useState } from 'react';

/** O pedido está lento a partir daqui: o critério da #543 («sem resposta em 4 s, dizer que está lento»). */
export const SLOW_AFTER_MS = 4000;

/**
 * `true` quando `active` está ligado há mais de `ms`; volta a `false` assim que desliga. Serve para dizer
 * que um envio está a demorar (#543), em vez de deixar «A processar…» sem explicação.
 */
export function useSlowAfter(active: boolean, ms: number = SLOW_AFTER_MS): boolean {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!active) return;
    const timer = window.setTimeout(() => setSlow(true), ms);
    return () => {
      window.clearTimeout(timer);
      setSlow(false);
    };
  }, [active, ms]);
  return active && slow;
}
