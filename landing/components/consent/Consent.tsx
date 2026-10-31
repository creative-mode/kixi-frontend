'use client';

import { useEffect, useRef, useState } from 'react';
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

/** O banner de cookies. Aceitar liga a analítica, "só necessários" não pede nada a terceiros.
 *  Compacto em ecrã estreito (#545): frase curta em largura total e os dois botões do
 *  mesmo peso por baixo, sem cortar texto — o consentimento tem de ser informado. */
export function CookieBanner() {
  const [choice, setChoice] = useState<Consent | null | undefined>(undefined);
  const banner = useRef<HTMLElement | null>(null);
  /** Onde o foco estava antes do banner aparecer: a escolha e o Esc devolvem-no lá. */
  const antes = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const sync = () => {
      setChoice(readConsent());
    };
    sync();
    window.addEventListener(CONSENT_EVENT, sync);
    return () => window.removeEventListener(CONSENT_EVENT, sync);
  }, []);

  // O foco corre depois do commit: na primeira renderização o banner nem existe ainda
  // (`choice === undefined` até ler o localStorage), e o ref de um estado trocado no
  // mesmo efeito chega vazio. Quem já está a escrever não é interrompido: o banner
  // fica só no fluxo do Tab.
  useEffect(() => {
    if (choice !== null) return;
    const atual = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    antes.current = atual;
    if (
      atual instanceof HTMLInputElement ||
      atual instanceof HTMLTextAreaElement ||
      atual instanceof HTMLSelectElement
    ) {
      return;
    }
    banner.current?.focus();
  }, [choice]);

  useEffect(() => {
    if (choice === 'all') {
      if (GA_ID) (window as unknown as Record<string, boolean>)[`ga-disable-${GA_ID}`] = false;
      loadAnalytics();
    } else if (choice === 'necessary') stopAnalytics();
  }, [choice]);

  if (choice !== null) return null;

  /** O banner não é modal: o foco começa lá dentro, mas ninguém fica preso nele.
   *  Sem destino válido (o caso normal é o body, que não é focável), tirar o
   *  foco do banner chega à página. */
  const devolverFoco = () => {
    const alvo = antes.current;
    if (alvo && alvo !== document.body && document.contains(alvo)) alvo.focus();
    else banner.current?.blur();
  };
  const escolher = (c: Consent) => {
    writeConsent(c);
    devolverFoco();
  };

  return (
    <section
      ref={banner}
      tabIndex={-1}
      role="dialog"
      aria-labelledby="ck-title"
      aria-modal="false"
      onKeyDown={(e) => e.key === 'Escape' && devolverFoco()}
      className="ck"
    >
      <div className="ck__in">
        <div className="ck__text">
          <h2 id="ck-title" className="ck__title">Cookies</h2>
          <p>
            {/* O h2 já diz "Cookies": sem o aria-hidden o leitor ouvia duas vezes. */}
            <strong className="ck__lead" aria-hidden="true">Cookies.</strong> Só usamos estatísticas
            anónimas para melhorar o Kixi se aceitares.{' '}
            <Link href="/cookies">Saber mais</Link>
          </p>
        </div>
        {/* Mesmo peso visual nos dois: a escolha é do visitante, não empurrada. */}
        <div className="ck__actions">
          <span className="kx-btn-wrap kx-scope"><button type="button" className="kx-btn kx-btn--sm kx-btn--secondary" onClick={() => escolher('necessary')}><span className="kx-btn__label">Só necessários</span></button></span>
          <span className="kx-btn-wrap kx-scope"><button type="button" className="kx-btn kx-btn--sm kx-btn--secondary" onClick={() => escolher('all')}><span className="kx-btn__label">Aceitar</span></button></span>
        </div>
      </div>
    </section>
  );
}
