import { GA_ID, readConsent, type Consent } from './consent.ts';

/**
 * Os eventos de produto da v1 (#219) que acontecem no app do aluno, num sítio só.
 *
 * O nome de um evento é contrato com os painéis: renomeá-lo parte o histórico. Ficam
 * aqui, fechados, para não nascerem nomes diferentes em cada ecrã e para o catálogo
 * poder ser lido a par do documento (`docs/analytics.md`).
 */
export const EVENTS = {
  /** A conta foi criada e a sessão começou. */
  registrationDone: 'registo_concluido',
  /** A matrícula no último passo do onboarding foi aceite. */
  onboardingDone: 'onboarding_concluido',
  /** Uma simulação nova foi criada. */
  examStarted: 'prova_iniciada',
  /** A prova foi entregue (ou já estava entregue). */
  examSubmitted: 'prova_submetida',
  /** O tutor respondeu a uma pergunta. */
  tutorUsed: 'tutor_usado',
  /** O aluno entrou numa sala de prova a decorrer. */
  roomEntered: 'sala_entrada',
} as const;

export type EventName = (typeof EVENTS)[keyof typeof EVENTS];

/** Só valores simples entram num evento; objetos aninhados eram um convite a PII. */
export type EventParams = Record<string, string | number | boolean>;

const EVENT_NAMES = new Set<string>(Object.values(EVENTS));

export function isEventName(value: unknown): value is EventName {
  return typeof value === 'string' && EVENT_NAMES.has(value);
}

/** O parâmetro que uma server action põe no redirect para o evento chegar ao cliente. */
export const EVENT_PARAM = 'evento';

/**
 * Junta o evento ao caminho de um `redirect` (#219).
 *
 * Os eventos que fecham numa server action — registo, onboarding, prova — só são certos
 * depois de o servidor ter feito o trabalho, e é ele que redirecciona. O caminho do
 * `redirect` viaja no cabeçalho que o cliente acrescenta ao basePath: pôr o evento ali
 * é o que garante que ele dispara **no sucesso**, e não a cada visita à página.
 *
 * Um destino com origem própria (o gestor) fica sem marcador: o parâmetro perder-se-ia
 * na mudança de origem e o evento do aluno não é do gestor.
 */
export function withEvent(path: string, event: EventName): string {
  if (!path.startsWith('/')) return path;
  return `${path}${path.includes('?') ? '&' : '?'}${EVENT_PARAM}=${event}`;
}

/** O evento marcado num `search` (ex.: `?evento=registo_concluido`), se for conhecido. */
export function eventInSearch(search: string): EventName | null {
  const value = new URLSearchParams(search).get(EVENT_PARAM);
  return isEventName(value) ? value : null;
}

/** O mesmo `search` sem o marcador, para o endereço não ficar a acusar o evento. */
export function searchWithoutEvent(search: string): string {
  const params = new URLSearchParams(search);
  params.delete(EVENT_PARAM);
  const rest = params.toString();
  return rest ? `?${rest}` : '';
}

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
