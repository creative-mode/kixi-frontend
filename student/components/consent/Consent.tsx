'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { CONSENT_EVENT, GA_ID, readConsent, writeConsent, type Consent } from '@/lib/consent';

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

/**
 * Espelhado em landing/components/consent/Consent.tsx (kixi#219): mesma lógica de
 * consentimento e de carregamento do Google Analytics, só a casca visual é que segue o
 * resto da app do aluno (Tailwind + componentes de `components/ui`) em vez do CSS da
 * landing. Se alterares a regra aqui, considera alterar lá também.
 *
 * Carrega o Google Analytics, e só depois de aceitar. IP anonimizado e sem sinais de publicidade.
 */
function loadAnalytics() {
  if (!GA_ID || document.getElementById('kixi-ga')) return;
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer!.push(arguments);
  };
  window.gtag('js', new Date());
  window.gtag('config', GA_ID, { anonymize_ip: true, allow_google_signals: false, allow_ad_personalization_signals: false });
  const s = document.createElement('script');
  s.id = 'kixi-ga';
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_ID)}`;
  // Um bloqueador de anúncios pode recusar o script: falha em silêncio, a página não depende dele.
  s.onerror = () => {};
  document.head.appendChild(s);
}

/** Retirar o consentimento: pára a medição desta página e apaga os cookies do Google Analytics. */
function stopAnalytics() {
  if (GA_ID) (window as unknown as Record<string, boolean>)[`ga-disable-${GA_ID}`] = true;
  const host = location.hostname.split('.');
  const domains = [location.hostname, ...host.map((_, i) => '.' + host.slice(i).join('.')).filter((d) => d.split('.').length > 2)];
  for (const name of document.cookie.split(';').map((c) => c.split('=')[0].trim())) {
    if (name !== '_ga' && !name.startsWith('_ga_')) continue;
    for (const d of [undefined, ...domains]) {
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/${d ? `; domain=${d}` : ''}`;
    }
  }
}

/** O banner de cookies. Aceitar liga a analítica, "só necessários" não pede nada a terceiros.
 *  `landingOrigin` vem do servidor (APP_ORIGIN): sem ele, "Saber mais" não tem onde apontar
 *  — a página de cookies vive só na landing — e fica de fora em vez de ligar a um 404. */
export function CookieBanner({ landingOrigin }: { landingOrigin: string | null }) {
  const [choice, setChoice] = useState<Consent | null | undefined>(undefined);

  useEffect(() => {
    const sync = () => setChoice(readConsent());
    sync();
    window.addEventListener(CONSENT_EVENT, sync);
    return () => window.removeEventListener(CONSENT_EVENT, sync);
  }, []);

  useEffect(() => {
    if (choice === 'all') {
      if (GA_ID) (window as unknown as Record<string, boolean>)[`ga-disable-${GA_ID}`] = false;
      loadAnalytics();
    } else if (choice === 'necessary') stopAnalytics();
  }, [choice]);

  if (choice !== null) return null;

  return (
    <section
      role="dialog"
      aria-labelledby="ck-title"
      aria-modal="false"
      className="fixed inset-x-0 bottom-0 z-50 border-t bg-background p-4 shadow-lg sm:p-6"
    >
      <div className="mx-auto flex max-w-3xl flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-muted-foreground">
          <h2 id="ck-title" className="text-sm font-semibold text-foreground">Cookies</h2>
          <p>
            Usamos o necessário para o site funcionar. Com a tua permissão, usamos também estatísticas
            anónimas para melhorar o Kixi.
            {landingOrigin && (
              <>
                {' '}
                <a href={`${landingOrigin}/cookies`} className="underline underline-offset-2">Saber mais</a>
              </>
            )}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => writeConsent('necessary')}>
            Só necessários
          </Button>
          <Button type="button" size="sm" onClick={() => writeConsent('all')}>
            Aceitar
          </Button>
        </div>
      </div>
    </section>
  );
}
