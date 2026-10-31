'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Confirm } from './confirm';
import { BASE_PATH } from '@/lib/constants';

/** Browser unload protection plus an accessible confirmation for in-app exits. */
export function useUnsavedChanges(dirty: boolean) {
  const [leaving, setLeaving] = useState<(() => void) | null>(null);
  const router = useRouter();
  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', beforeUnload);
    const onDocumentClick = (event: MouseEvent) => {
      if (!dirty || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest('a[href]');
      if (!(anchor instanceof HTMLAnchorElement) || anchor.target || anchor.hasAttribute('download')) return;
      const destination = new URL(anchor.href, window.location.href);
      if (destination.origin !== window.location.origin || destination.href === window.location.href) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const pathname = destination.pathname.startsWith(`${BASE_PATH}/`) || destination.pathname === BASE_PATH
        ? destination.pathname.slice(BASE_PATH.length) || '/'
        : destination.pathname;
      setLeaving(() => () => router.push(`${pathname}${destination.search}${destination.hash}`));
    };
    document.addEventListener('click', onDocumentClick, true);
    return () => {
      window.removeEventListener('beforeunload', beforeUnload);
      document.removeEventListener('click', onDocumentClick, true);
    };
  }, [dirty, router]);
  const guard = (next: () => void) => dirty ? setLeaving(() => next) : next();
  return {
    guard,
    dialog: <Confirm state={leaving ? {
      title: 'Descartar alterações?', description: 'Tem alterações por guardar. Se sair agora, elas serão perdidas.',
      action: 'Descartar e sair', destructive: true, run: () => { leaving(); },
    } : null} onClose={() => setLeaving(null)} />,
  };
}
