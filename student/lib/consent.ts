/**
 * O consentimento de cookies vive no `localStorage`, com a **mesma chave da landing**:
 * o gateway serve a landing, o aluno e o gestor na mesma origem, por isso a escolha
 * feita no banner da landing vale também aqui (#217, #219). Sem escolha, não há
 * analítica — o app funciona todo por igual.
 */
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
