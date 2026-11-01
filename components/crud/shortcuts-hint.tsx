'use client';

import { useId } from 'react';
import { useShortcutsEnabled } from '@/hooks/use-queue-shortcuts';

/**
 * A legenda dos atalhos de uma página: o que se carrega e o que faz, em texto, para quem não os vê anunciados, e o
 * interruptor para os desligar (WCAG 2.1.4: um atalho de uma só tecla tem de poder desligar-se).
 */
export function ShortcutsHint({ items }: { items: { keys: string[]; label: string }[] }) {
  const [on, setOn] = useShortcutsEnabled();
  const id = useId();
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground print:hidden">
      <p>
        <span className="font-medium">Atalhos:</span>{' '}
        {items.map((item, index) => (
          <span key={item.label}>
            {index > 0 ? ' · ' : ''}
            {item.keys.map((key, i) => (
              <span key={key}>
                {i > 0 ? ' / ' : ''}
                <kbd className="rounded border bg-muted px-1 font-mono text-[11px] text-foreground">{key}</kbd>
              </span>
            ))}{' '}
            {item.label}
          </span>
        ))}
        . Não funcionam enquanto se escreve num campo.
      </p>
      <label htmlFor={id} className="flex min-h-11 cursor-pointer items-center gap-2">
        <input id={id} type="checkbox" className="size-4" checked={on} onChange={(event) => setOn(event.target.checked)} />
        Atalhos de teclado ligados
      </label>
    </div>
  );
}
