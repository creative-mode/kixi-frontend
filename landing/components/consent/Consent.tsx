'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CONSENT_EVENT, GA_ID, readConsent, writeConsent, type Consent } from '@/lib/consent';

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

/** Carrega o Google Analytics, e só depois de aceitar. IP anonimizado e sem sinais de publicidade. */
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

/** O banner de cookies. Aceitar liga a analítica, "só necessários" não pede nada a terceiros. */
export function CookieBanner() {
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
    <section role="dialog" aria-labelledby="ck-title" aria-modal="false" className="ck">
      <div className="ck__in">
        <div className="ck__text">
          <h2 id="ck-title" className="ck__title">Cookies</h2>
          <p>
            Usamos o necessário para o site funcionar. Com a tua permissão, usamos também estatísticas anónimas para melhorar o Kixi.{' '}
            <Link href="/cookies">Saber mais</Link>
          </p>
        </div>
        <div className="ck__actions">
          <span className="kx-btn-wrap kx-scope"><button type="button" className="kx-btn kx-btn--secondary" onClick={() => writeConsent('necessary')}><span className="kx-btn__label">Só necessários</span></button></span>
          <span className="kx-btn-wrap kx-scope"><button type="button" className="kx-btn kx-btn--a" onClick={() => writeConsent('all')}><span className="kx-btn__label">Aceitar</span></button></span>
        </div>
      </div>
    </section>
  );
}
