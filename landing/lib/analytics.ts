import { GA_ID, readConsent, type Consent } from './consent.ts';

/**
 * Os eventos de produto da v1 (#219), num sítio só.
 *
 * O nome de um evento é contrato com os painéis: renomeá-lo parte o histórico. Ficam
 * aqui, fechados, para não nascerem nomes diferentes em cada ecrã e para o catálogo
 * poder ser lido a par do documento (`docs/analytics.md`).
 */
export const EVENTS = {
  /** A doação de um enunciado foi aceite pelo backend (referência devolvida). */
  donationSubmitted: 'doacao_submetida',
} as const;

export type EventName = (typeof EVENTS)[keyof typeof EVENTS];

/** Só valores simples entram num evento; objetos aninhados eram um convite a PII. */
export type EventParams = Record<string, string | number | boolean>;

type Gtag = (...args: unknown[]) => void;

/**
 * A analítica só existe com a escolha «tudo» e a propriedade configurada.
 *
 * «Só necessários», sem escolha, e `NEXT_PUBLIC_GA_ID` vazio são todos «não». A regra
 * fica numa função pura, para se poder testar sem browser e para não haver duas
 * versões dela a divergir.
 */
export function canTrack(consent: Consent | null, gaId: string): boolean {
  return consent === 'all' && gaId !== '';
}

/**
 * Envia um evento, se estiver consentido, e diz se o enviou. O `gtag` entra por
 * parâmetro para os testes não precisarem de um `window`.
 */
export function sendEvent(
  gtag: Gtag | undefined,
  consent: Consent | null,
  gaId: string,
  name: EventName,
  params?: EventParams,
): boolean {
  if (!canTrack(consent, gaId) || typeof gtag !== 'function') return false;
  gtag('event', name, params ?? {});
  return true;
}

/**
 * Regista um evento de produto a partir de um componente cliente.
 *
 * Falha em silêncio por desenho: sem consentimento — ou sem `gtag`, quando um
 * bloqueador de anúncios recusa o script — não faz nada e ninguém depende do
 * resultado. Não passe aqui dados pessoais nem texto escrito pelo aluno: só o que a
 * lista de eventos documentar (`docs/analytics.md`).
 */
export function track(name: EventName, params?: EventParams): void {
  if (typeof window === 'undefined') return;
  sendEvent((window as unknown as { gtag?: Gtag }).gtag, readConsent(), GA_ID, name, params);
}
