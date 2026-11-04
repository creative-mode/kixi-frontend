/**
 * Espelhado em student/lib/consent.ts (kixi#219): a app do aluno tem o seu próprio
 * banner e a sua própria analítica, com o mesmo contrato. Se alterares a regra de
 * consentimento aqui, altera lá também.
 *
 * O consentimento de cookies: guardado só no navegador, em localStorage. Sem escolha não há analítica.
 */
export const CONSENT_KEY = 'kixi-consent';
export const CONSENT_EVENT = 'kixi-consent-change';

export type Consent = 'all' | 'necessary';

/** O Google Analytics só existe se o endereço da propriedade vier do ambiente (build). */
export const GA_ID = process.env.NEXT_PUBLIC_GA_ID ?? '';

export function removePendingAnalyticsCommands(dataLayer: unknown[]): void {
  const retained = dataLayer.filter((entry) => {
    const command = entry && typeof entry === 'object' && 'length' in entry
      ? Array.from(entry as ArrayLike<unknown>) : [];
    return command[0] !== 'event' && command[0] !== 'config';
  });
  dataLayer.splice(0, dataLayer.length, ...retained);
}

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    __kixiAnalyticsAllowed?: boolean;
  }
}

/** Synchronous kill switch. A disabled tag cannot dispatch future queued commands. */
export function setAnalyticsEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  window.__kixiAnalyticsAllowed = enabled;
  if (GA_ID) (window as unknown as Record<string, boolean>)[`ga-disable-${GA_ID}`] = !enabled;
  if (!enabled && window.dataLayer) {
    // Purge commands not consumed yet; requests already sent by the browser cannot be recalled.
    removePendingAnalyticsCommands(window.dataLayer);
  }
  if (!enabled && typeof document !== 'undefined') {
    const names = document.cookie.split(';').map((cookie) => cookie.split('=')[0].trim());
    const host = window.location.hostname.split('.');
    const domains = [window.location.hostname, ...host.map((_, i) => `.${host.slice(i).join('.')}`).filter((d) => d.split('.').length > 2)];
    for (const name of names) {
      if (name !== '_ga' && !name.startsWith('_ga_')) continue;
      for (const domain of [undefined, ...domains]) {
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/${domain ? `; domain=${domain}` : ''}`;
      }
    }
  }
}

export function readConsent(): Consent | null {
  try {
    const v = localStorage.getItem(CONSENT_KEY);
    return v === 'all' || v === 'necessary' ? v : null;
  } catch {
    return null;
  }
}

export function writeConsent(value: Consent | null): void {
  setAnalyticsEnabled(value === 'all');
  try {
    if (value) localStorage.setItem(CONSENT_KEY, value);
    else localStorage.removeItem(CONSENT_KEY);
  } catch {
    /* modo privado ou quota: a escolha vale só para esta visita */
  }
  window.dispatchEvent(new Event(CONSENT_EVENT));
}

/** Reabre o banner, a partir do rodapé. */
export function reopenConsent(): void {
  writeConsent(null);
}
