'use client';

import { useEffect, useState } from 'react';

/** Um número que sobe até ao valor, em passos curtos: o resultado «chega» em vez de aparecer. Sem movimento se o aluno o pediu. */
export function CountUp({ value, ms = 700 }: { value: string; ms?: number }) {
  const target = /^\d+([.,]\d+)?$/.test(value) ? Number(value.replace(',', '.')) : null;
  const [shown, setShown] = useState<string>(value);

  useEffect(() => {
    if (target === null) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.reduceMotion === 'true';
    if (reduced) { setShown(value); return; }
    const decimals = /[.,](\d+)$/.exec(value)?.[1].length ?? 0;
    const comma = value.includes(',');
    const t0 = performance.now();
    let id = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / ms);
      const eased = 1 - (1 - p) ** 3;
      const text = (target * eased).toFixed(decimals);
      setShown(comma ? text.replace('.', ',') : text);
      if (p < 1) id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [value, target, ms]);

  return <span aria-label={value}>{shown}</span>;
}
