'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { CONSENT_EVENT } from '@/lib/consent';
import {
  attributionFromSearch,
  pageForPath,
  scrollDepthsReached,
  setSafePageContext,
  track,
  type AnalyticsApp,
  type TrackStatus,
} from '@/lib/analytics';

/**
 * Os eventos que nascem da navegação, não de um clique (#714). Igual em `landing/` e `student/`
 * (`components/analytics/trackers.tsx`); `lib/analytics-mirror.test.ts` falha se divergirem.
 *
 * Um evento só conta como feito quando `track` o aceita (`sent` ou `queued`): sem consentimento é
 * `denied`, e o mesmo ecrã volta a tentar quando a pessoa aceita (`CONSENT_EVENT`) ou volta a fazer scroll.
 */
const counted = (status: TrackStatus) => status === 'sent' || status === 'queued';

/** Um `page_view` por rota, com o contexto de página canónico antes de o enviar. */
export function PageViewTracker({ app }: { app: AnalyticsApp }) {
  const pathname = usePathname();
  // Fora do efeito, para o Strict Mode (efeito duas vezes) e as mudanças de consentimento não duplicarem.
  const sent = useRef<string | null>(null);

  useEffect(() => {
    const send = () => {
      if (sent.current === pathname) return;
      const full = window.location.pathname;
      setSafePageContext(app, full);
      const status = track('page_view', { app, page: pageForPath(app, full), ...attributionFromSearch(window.location.search) });
      if (counted(status)) sent.current = pathname;
    };
    send();
    window.addEventListener(CONSENT_EVENT, send);
    return () => window.removeEventListener(CONSENT_EVENT, send);
  }, [app, pathname]);

  return null;
}

/** `scroll_depth` da landing: cada limiar uma vez por montagem da página, medido só quando há scroll. */
export function ScrollDepthTracker() {
  const pathname = usePathname();

  useEffect(() => {
    const done = new Set<number>();
    let frame = 0;
    const measure = () => {
      frame = 0;
      const page = pageForPath('landing', window.location.pathname);
      for (const depth of scrollDepthsReached(window.scrollY, window.innerHeight, document.documentElement.scrollHeight)) {
        if (!done.has(depth) && counted(track('scroll_depth', { app: 'landing', page, depth }))) done.add(depth);
      }
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [pathname]);

  return null;
}

/** `error_view` de uma página de erro (403, 404, erro inesperado), uma vez por montagem. */
export function ErrorView({ app, kind }: { app: AnalyticsApp; kind: 'forbidden' | 'not_found' | 'unexpected' }) {
  const done = useRef(false);

  useEffect(() => {
    if (!done.current && counted(track('error_view', { app, kind }))) done.current = true;
  }, [app, kind]);

  return null;
}
