/** O consentimento de cookies: guardado só no navegador, em localStorage. Sem escolha não há analítica. */
export const CONSENT_KEY = 'kixi-consent';
export const CONSENT_EVENT = 'kixi-consent-change';

export type Consent = 'all' | 'necessary';

/** O Google Analytics só existe se o endereço da propriedade vier do ambiente (build). */
export const GA_ID = process.env.NEXT_PUBLIC_GA_ID ?? '';

export function readConsent(): Consent | null {
  try {
    const v = localStorage.getItem(CONSENT_KEY);
    return v === 'all' || v === 'necessary' ? v : null;
  } catch {
    return null;
  }
}

export function writeConsent(value: Consent | null): void {
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
