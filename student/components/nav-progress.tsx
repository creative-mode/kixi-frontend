'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

/**
 * Uma barra fina no topo que arranca no instante do clique numa ligação interna e acaba quando a página nova
 * chega. Sem ela o ecrã ficava parado até o servidor responder, e parado parece avariado: com ela, o clique
 * responde logo (como no X ou no Instagram) mesmo que o servidor demore. Não pede nada à rede.
 */
function Bar() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const [phase, setPhase] = useState<'idle' | 'run' | 'done'>('idle');
  const timers = useRef<number[]>([]);

  const clear = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  };

  // A página nova chegou: a barra completa-se e some.
  useEffect(() => {
    setPhase((p) => (p === 'run' ? 'done' : p));
    clear();
    const t = window.setTimeout(() => setPhase('idle'), 350);
    timers.current.push(t);
    return clear;
  }, [pathname, search]);

  // O clique numa ligação interna que muda de página arranca-a.
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download')) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      clear();
      setPhase('run');
      // Rede de segurança: se a navegação não acontecer, a barra não fica presa.
      timers.current.push(window.setTimeout(() => setPhase('idle'), 12000));
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-0.5">
      <div
        className="h-full origin-left bg-primary motion-reduce:transition-none"
        style={{
          width: phase === 'idle' ? '0%' : phase === 'run' ? '80%' : '100%',
          opacity: phase === 'idle' ? 0 : 1,
          transition: phase === 'run' ? 'width 6s cubic-bezier(.1,.6,.2,1)' : phase === 'done' ? 'width 150ms ease-out, opacity 250ms ease-out 150ms' : 'none',
        }}
      />
    </div>
  );
}

export function NavProgress() {
  return (
    <Suspense fallback={null}>
      <Bar />
    </Suspense>
  );
}
