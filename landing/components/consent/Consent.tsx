'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { CONSENT_EVENT, GA_ID, readConsent, setAnalyticsEnabled, writeConsent, type Consent } from '@/lib/consent';
import { flushAnalytics, pageForPath, safePageLocation, track } from '@/lib/analytics';

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
  // Sem page view automático (o `config` mandá-lo-ia com a URL real, query incluída) e com o contexto de página
  // já canónico: qualquer evento automático do Google tag sai com origem + rota, sem query nem referrer (#517).
  const page = safePageLocation('landing', pageForPath('landing', window.location.pathname), window.location.origin);
  window.gtag('config', GA_ID, {
    anonymize_ip: true,
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
    send_page_view: false,
    page_location: page,
    page_referrer: '',
  });
  const s = document.createElement('script');
  s.id = 'kixi-ga';
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_ID)}`;
  // Um bloqueador de anúncios pode recusar o script: falha em silêncio, a página não depende dele.
  s.onerror = () => {};
  document.head.appendChild(s);
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

  // A altura real do banner fica em `--ck-banner-h` (medida como no #506): o
  // `/doar` reserva-a em baixo e nunca tapa o "Continuar". Medida e não uma
  // constante, e 0 px quando já há escolha (o banner desmonta e a variável sai).
  useEffect(() => {
    const el = banner.current;
    if (!el) return;
    const root = document.documentElement;
    const reserve = () => root.style.setProperty('--ck-banner-h', `${el.getBoundingClientRect().height}px`);
    reserve();
    const observer = new ResizeObserver(reserve);
    observer.observe(el);
    return () => {
      observer.disconnect();
      root.style.removeProperty('--ck-banner-h');
    };
  }, [choice]);

  useEffect(() => {
    if (choice === 'all') {
      setAnalyticsEnabled(true);
      loadAnalytics();
      // O que se pôs na fila antes de haver `gtag` (o page_view da chegada, por exemplo) sai agora (#714).
      flushAnalytics();
    } else if (choice === 'necessary') {
      // Pára a medição desta página e apaga os cookies do Google Analytics (lib/consent.ts).
      setAnalyticsEnabled(false);
    }
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
    // Só o aceitar se mede: registar uma recusa seria medir quem disse que não.
    if (c === 'all') track('consent_choice', { choice: 'all', app: 'landing' });
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
