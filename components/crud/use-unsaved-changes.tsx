'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Confirm } from './confirm';
import { BASE_PATH } from '@/lib/constants';

const activeGuards = new Set<(next: () => void) => void>();

/** Let layout actions such as logout use the active form's accessible confirmation. */
export function guardGlobalUnsavedChanges(next: () => void) {
  const active = activeGuards.values().next().value;
  if (active) active(next);
  else next();
}

/** Browser unload protection plus an accessible confirmation for in-app exits. */
export function useUnsavedChanges(dirty: boolean, description = 'Tem alterações por guardar. Se sair agora, elas serão perdidas.') {
  const [leaving, setLeaving] = useState<(() => void) | null>(null);
  const router = useRouter();
  useEffect(() => {
    if (!dirty) return;
    const ask = (next: () => void) => setLeaving(() => next);
    activeGuards.add(ask);
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', beforeUnload);
    const onDocumentClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest('a[href]');
      if (!(anchor instanceof HTMLAnchorElement) || anchor.target || anchor.hasAttribute('download')) return;
      const destination = new URL(anchor.href, window.location.href);
      if (destination.origin !== window.location.origin
        || (destination.pathname === window.location.pathname && destination.search === window.location.search)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const pathname = destination.pathname.startsWith(`${BASE_PATH}/`) || destination.pathname === BASE_PATH
        ? destination.pathname.slice(BASE_PATH.length) || '/'
        : destination.pathname;
      setLeaving(() => () => router.push(`${pathname}${destination.search}${destination.hash}`));
    };
    document.addEventListener('click', onDocumentClick, true);
    const marker = `unsaved-${Math.random()}`;
    const guardedPath = window.location.pathname;
    let leavingByBack = false;
    window.history.pushState({ ...window.history.state, __unsavedGuard: marker }, '', window.location.href);
    const onBack = () => {
      if (leavingByBack || window.location.pathname !== guardedPath) return;
      window.history.pushState({ ...window.history.state, __unsavedGuard: marker }, '', window.location.href);
      ask(() => { leavingByBack = true; window.history.go(-2); });
    };
    window.addEventListener('popstate', onBack);
    return () => {
      activeGuards.delete(ask);
      window.removeEventListener('beforeunload', beforeUnload);
      document.removeEventListener('click', onDocumentClick, true);
      window.removeEventListener('popstate', onBack);
    };
  }, [dirty, router]);
  const guard = (next: () => void) => dirty ? setLeaving(() => next) : next();
  return {
    guard,
    dialog: <Confirm state={leaving ? {
      title: 'Descartar alterações?', description,
      action: 'Descartar e sair', destructive: true, run: () => { leaving(); },
    } : null} onClose={() => setLeaving(null)} />,
  };
}
