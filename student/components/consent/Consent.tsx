'use client';

import { useEffect, useRef, useState } from 'react';
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
 *  — a página de cookies vive só na landing — e fica de fora em vez de ligar a um 404.
 *  Compacto em ecrã estreito (#545): frase curta em largura total e os dois botões do
 *  mesmo peso por baixo, sem cortar texto — o consentimento tem de ser informado. */
export function CookieBanner({ landingOrigin }: { landingOrigin: string | null }) {
  const [choice, setChoice] = useState<Consent | null | undefined>(undefined);
  const banner = useRef<HTMLElement>(null);
  /** Onde o foco estava antes do banner aparecer: a escolha e o Esc devolvem-no lá. */
  const antes = useRef<HTMLElement | null>(null);

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

  // A altura real do banner fica em `--ck-banner-h` (#506). A barra inferior do `Shell` sobe por
  // cima dele e o fim do conteúdo ganha o mesmo espaço, em vez de ficar tapado até haver escolha.
  // Medida e não uma constante: o banner tem duas linhas no telemóvel e uma no portátil.
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

  // Quem chega ouve o pedido de consentimento, e ao fechar o foco volta para onde estava (#506).
  // Quem já está a escrever (o entrar tem autoFocus no campo do utilizador) não é
  // interrompido: o banner fica só no fluxo do Tab (#545).
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
    return () => {
      const before = antes.current;
      if (before && before !== document.body && before.isConnected) before.focus();
    };
  }, [choice]);

  if (choice !== null) return null;

  /** O banner não é modal: ninguém fica preso nele. Sem destino válido (o caso
   *  normal é o body, que não é focável), tirar o foco do banner chega à página. */
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
      role="dialog"
      aria-labelledby="ck-title"
      aria-describedby="ck-desc"
      aria-modal="false"
      tabIndex={-1}
      onKeyDown={(e) => e.key === 'Escape' && devolverFoco()}
      className="fixed inset-x-0 bottom-0 z-50 border-t bg-background shadow-lg"
    >
      {/* Texto em largura total e botões por baixo: sem corte, lê-se tudo (#545).
          O "necessário para funcionar" fica só na página de cookies. */}
      <div className="mx-auto flex max-w-3xl flex-col gap-2 px-3 py-2 sm:flex-row sm:items-center sm:gap-3 sm:px-6 sm:py-4">
        <div className="min-w-0 flex-1 text-[13px] leading-snug text-muted-foreground sm:text-sm">
          <h2 id="ck-title" className="text-sm font-semibold text-foreground sr-only sm:not-sr-only">Cookies</h2>
          <p id="ck-desc">
            {/* Título visível só no telemóvel (o h2 chega aí escondido): sem ele o
                diálogo não tinha rótulo à vista. Escondido da árvore, que já ouve o h2. */}
            <strong aria-hidden="true" className="sm:hidden">Cookies.</strong> Só usamos estatísticas
            anónimas para melhorar o Kixi se aceitares.
            {landingOrigin && (
              <>
                {' '}
                <a href={`${landingOrigin}/cookies`} className="underline underline-offset-2">Saber mais</a>
              </>
            )}
          </p>
        </div>
        {/* Mesmo peso visual nos dois (também #506): a escolha é do aluno, não empurrada.
            No telemóvel os botões são h-9: o h-11 de omissão não cabia nos 12% com o
            texto por cima. */}
        <div className="flex shrink-0 gap-2">
          <Button type="button" variant="secondary" size="sm" className="h-9 flex-1 sm:flex-none" onClick={() => escolher('necessary')}>
            Só necessários
          </Button>
          <Button type="button" variant="secondary" size="sm" className="h-9 flex-1 sm:flex-none" onClick={() => escolher('all')}>
            Aceitar
          </Button>
        </div>
      </div>
    </section>
  );
}
