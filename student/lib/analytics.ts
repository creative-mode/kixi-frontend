/**
 * Eventos mínimos v1 de produto (kixi-frontend#219): sem PII, sem texto livre do aluno —
 * só o nome do evento e, no máximo, IDs já anonimizados que a própria conta não expõe
 * (nunca nome, email ou texto de resposta).
 *
 * `track` nunca força o carregamento do Google Analytics: só manda o evento se o
 * `gtag` já estiver lá, o que só acontece depois de `CookieBanner` o carregar com
 * consentimento (`components/consent/Consent.tsx`). Sem consentimento, sem `gtag`, sem
 * pedido a terceiros — chamar isto é sempre seguro, com ou sem analítica ligada.
 */
export function track(event: string, params: Record<string, string | number | boolean> = {}): void {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return;
  window.gtag('event', event, params);
}
