'use client';

import { useEffect } from 'react';
import { CONSENT_EVENT, GA_ID, readConsent } from '@/lib/consent';
import { eventInSearch, searchWithoutEvent, track } from '@/lib/analytics';

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

/** Carrega o Google Analytics, e só depois de aceitar. IP anonimizado e sem sinais de publicidade.
 *  O mesmo carregamento da landing: a escolha de cookies é a mesma, na mesma origem. */
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

/**
 * A analítica do app do aluno (#219): carrega o GA quando a escolha de cookies é «tudo»
 * e dispara o evento que uma server action deixou no endereço, uma só vez.
 *
 * Não desenha nada. Fica no layout de raiz para cobrir o registo, o onboarding e as
 * páginas da app, que de outra forma precisavam cada uma do seu ponto de disparo.
 */
export function Analytics() {
  useEffect(() => {
    if (readConsent() === 'all') {
      if (GA_ID) (window as unknown as Record<string, boolean>)[`ga-disable-${GA_ID}`] = false;
      loadAnalytics();
    }

    // O evento que veio no redirect de uma server action: dispara no sucesso e sai do
    // endereço, para um recarregar da página não o contar duas vezes.
    const event = eventInSearch(window.location.search);
    if (event) {
      track(event);
      history.replaceState(null, '', window.location.pathname + searchWithoutEvent(window.location.search));
    }

    // Aceitar na landing dentro da mesma sessão liga a analítica sem recarregar.
    const onConsent = () => {
      if (readConsent() === 'all' && GA_ID) {
        (window as unknown as Record<string, boolean>)[`ga-disable-${GA_ID}`] = false;
        loadAnalytics();
      }
    };
    window.addEventListener(CONSENT_EVENT, onConsent);
    return () => window.removeEventListener(CONSENT_EVENT, onConsent);
  }, []);

  return null;
}
