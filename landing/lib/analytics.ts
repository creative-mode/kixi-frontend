/**
 * Contrato de eventos v1, igual nas três apps: lib/analytics.ts (gestor), student/lib/analytics.ts e
 * landing/lib/analytics.ts são cópias byte a byte (apps Next separadas, sem pacote partilhado).
 * Mudar um obriga a copiar para os outros dois: `lib/analytics-mirror.test.ts` falha enquanto divergirem.
 */
import { readConsent } from './consent.ts';

export type AnalyticsApp = 'manager' | 'student' | 'landing';
export type AnalyticsPage =
  | 'home' | 'donation' | 'privacy' | 'cookies' | 'login' | 'signup'
  | 'onboarding' | 'student_home' | 'exam' | 'result' | 'room'
  | 'dashboard' | 'forbidden' | 'not_found' | 'other';
export type AnalyticsEvent =
  | 'page_view' | 'cta_clique' | 'signup_started' | 'signup_error' | 'sign_up' | 'login_success'
  | 'donation_started' | 'donation_step' | 'donation_error' | 'donation_submitted'
  | 'consent_choice' | 'error_view' | 'exam_started' | 'exam_submitted'
  | 'exam_room_joined' | 'exam_abandoned' | 'scroll_depth' | 'onboarding_completed' | 'tutor_used';
export type AnalyticsParams = Record<string, string | number | boolean>;
export type TrackStatus = 'sent' | 'queued' | 'denied' | 'invalid' | 'overflow';
type Gtag = (...args: unknown[]) => void;
type QueueOptions = {
  hasConsent: () => boolean;
  getGtag: () => Gtag | undefined;
  getOrigin: () => string;
  getPathname?: () => string;
  maxPending?: number;
  onOverflow?: () => void;
  onDrained?: () => void;
};

export const MAX_PENDING_ANALYTICS_EVENTS = 100;
export const ANALYTICS_READY_EVENT = 'kixi-analytics-ready';

const PAGES: Record<AnalyticsApp, readonly AnalyticsPage[]> = {
  manager: ['login', 'dashboard', 'forbidden', 'not_found', 'other'],
  student: ['login', 'signup', 'onboarding', 'student_home', 'exam', 'result', 'room', 'forbidden', 'not_found', 'other'],
  landing: ['home', 'donation', 'privacy', 'cookies', 'forbidden', 'not_found', 'other'],
};
const PATHS: Record<AnalyticsApp, Partial<Record<AnalyticsPage, string>>> = {
  manager: { login: '/manager/login', dashboard: '/manager', forbidden: '/manager/403', not_found: '/manager/404', other: '/manager' },
  student: { login: '/aluno/entrar', signup: '/aluno/cadastro', onboarding: '/aluno/onboarding', student_home: '/aluno/inicio', exam: '/aluno/prova', result: '/aluno/resultado', room: '/aluno/sala', forbidden: '/aluno/403', not_found: '/aluno/404', other: '/aluno' },
  landing: { home: '/', donation: '/doar', privacy: '/privacidade', cookies: '/cookies', forbidden: '/403', not_found: '/404', other: '/' },
};
const UTM_ALLOWLIST = {
  utm_source: ['google', 'facebook', 'instagram', 'tiktok', 'youtube', 'whatsapp', 'newsletter', 'school', 'partner', 'qr', 'direct'],
  utm_medium: ['organic', 'cpc', 'paid_social', 'social', 'email', 'referral', 'partner', 'qr', 'print'],
  utm_campaign: ['launch', 'back_to_school', 'school_open_day', 'teacher_invite', 'student_invite'],
} as const;
const SIGNUP_FIELDS = ['first_name', 'last_name', 'username', 'email', 'password', 'confirm', 'form'] as const;
const DONATION_FIELDS = ['files', 'institution', 'subject', 'exam_type', 'class_grade', 'school_year', 'donor_name', 'donor_email', 'notes', 'consent', 'form'] as const;
/** De onde veio o clique num CTA da landing (`CtaOrigem`, #512). */
const CTA_ORIGENS = ['header', 'outro', 'faq', 'hero', 'provas', 'provas-empty', 'student-menu'] as const;
const DONATION_STEPS = ['statement', 'origin', 'contact'] as const;

function oneOf<T extends readonly string[]>(value: unknown, allowed: T): value is T[number] {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value);
}

export function sanitizeAttribution(input: URLSearchParams): Partial<Record<keyof typeof UTM_ALLOWLIST, string>> {
  const output: Partial<Record<keyof typeof UTM_ALLOWLIST, string>> = {};
  for (const key of Object.keys(UTM_ALLOWLIST) as (keyof typeof UTM_ALLOWLIST)[]) {
    const values = input.getAll(key);
    if (values.length !== 1) continue;
    const value = values[0].trim().toLowerCase();
    if ((UTM_ALLOWLIST[key] as readonly string[]).includes(value)) output[key] = value;
  }
  return output;
}

/** As UTMs permitidas de um `location.search`, para os eventos que as levam (`page_view`, `sign_up`, doação). */
export function attributionFromSearch(search: string): AnalyticsParams {
  return sanitizeAttribution(new URLSearchParams(search));
}

/** Limiares de `scroll_depth`, por ordem. */
export const SCROLL_DEPTHS = [25, 50, 75, 100] as const;

/** Os limiares já atingidos: a parte vista (topo + altura da janela) sobre a altura da página. */
export function scrollDepthsReached(scrollTop: number, viewportHeight: number, scrollHeight: number): number[] {
  if (!(scrollHeight > 0)) return [];
  // Meio píxel de folga: o fim da página dá 99,9 % com zoom ou píxeis fracionários.
  const seen = Math.min(100, ((Math.max(0, scrollTop) + viewportHeight + 0.5) / scrollHeight) * 100);
  return SCROLL_DEPTHS.filter((depth) => seen >= depth);
}

/** O campo do cadastro, no nome do contrato (`signup_error`). Um campo que não é do formulário fica `form`. */
export function signupField(name: string): (typeof SIGNUP_FIELDS)[number] {
  const map: Record<string, (typeof SIGNUP_FIELDS)[number]> = {
    firstName: 'first_name', lastName: 'last_name', username: 'username', email: 'email', password: 'password', confirm: 'confirm',
  };
  return map[name] ?? 'form';
}

/** O campo da doação, no nome do contrato (`donation_error`). Um campo que não é do formulário fica `form`. */
export function donationField(name: string): (typeof DONATION_FIELDS)[number] {
  const map: Record<string, (typeof DONATION_FIELDS)[number]> = {
    files: 'files', institutionName: 'institution', subjectName: 'subject', examType: 'exam_type', classGrade: 'class_grade',
    schoolYear: 'school_year', donorName: 'donor_name', donorEmail: 'donor_email', notes: 'notes', consent: 'consent',
  };
  return map[name] ?? 'form';
}

/** O ecrã da doação (0, 1, 2), no nome do contrato (`donation_step`/`donation_error`). */
export function donationStep(index: number): (typeof DONATION_STEPS)[number] {
  return DONATION_STEPS[Math.min(Math.max(0, Math.trunc(index)), DONATION_STEPS.length - 1)];
}

export function pageForPath(app: AnalyticsApp, pathname: string): AnalyticsPage {
  const path = pathname.replace(/\/+$/, '') || '/';
  if (app === 'landing') {
    if (path === '/') return 'home';
    if (path === '/doar') return 'donation';
    if (path === '/privacidade') return 'privacy';
    if (path === '/cookies') return 'cookies';
    if (path === '/403') return 'forbidden';
    return 'other';
  }
  if (app === 'student') {
    const route = path.replace(/^\/aluno(?=\/|$)/, '') || '/';
    if (route === '/entrar') return 'login';
    if (route === '/cadastro') return 'signup';
    if (route === '/onboarding') return 'onboarding';
    if (route === '/inicio') return 'student_home';
    if (/^\/prova\/[^/]+$/.test(route)) return 'exam';
    if (route === '/resultado') return 'result';
    if (/^\/sala\/[^/]+$/.test(route)) return 'room';
    if (route === '/403') return 'forbidden';
    return 'other';
  }
  const route = path.replace(/^\/manager(?=\/|$)/, '') || '/';
  if (route === '/login') return 'login';
  if (route === '/' || route === '/professor') return 'dashboard';
  if (route === '/403') return 'forbidden';
  return 'other';
}

export function sanitizeEvent(event: string, params: AnalyticsParams = {}): { event: AnalyticsEvent; params: AnalyticsParams } | null {
  switch (event) {
    case 'page_view': {
      const app = params.app;
      const page = params.page;
      if (!oneOf(app, ['manager', 'student', 'landing'] as const) || !oneOf(page, PAGES[app])) return null;
      const rawAttribution = new URLSearchParams();
      for (const key of Object.keys(UTM_ALLOWLIST) as (keyof typeof UTM_ALLOWLIST)[]) {
        if (typeof params[key] === 'string') rawAttribution.set(key, String(params[key]));
      }
      return { event, params: { app, page, ...sanitizeAttribution(rawAttribution) } };
    }
    case 'cta_clique':
      return oneOf(params.origem, CTA_ORIGENS) ? { event, params: { origem: params.origem } } : null;
    case 'signup_started':
      return params.surface === 'signup_form' ? { event, params: { surface: 'signup_form' } } : null;
    case 'signup_error':
      return oneOf(params.field, SIGNUP_FIELDS) && oneOf(params.category, ['validation', 'server'] as const)
        ? { event, params: { field: params.field, category: params.category } } : null;
    case 'login_success': {
      if (!oneOf(params.app, ['manager', 'student'] as const)) return null;
      const rawAttribution = new URLSearchParams();
      for (const key of Object.keys(UTM_ALLOWLIST) as (keyof typeof UTM_ALLOWLIST)[]) {
        if (typeof params[key] === 'string') rawAttribution.set(key, String(params[key]));
      }
      return { event, params: { app: params.app, ...sanitizeAttribution(rawAttribution) } };
    }
    case 'donation_started':
    case 'donation_submitted':
    case 'sign_up': {
      const rawAttribution = new URLSearchParams();
      for (const key of Object.keys(UTM_ALLOWLIST) as (keyof typeof UTM_ALLOWLIST)[]) {
        if (typeof params[key] === 'string') rawAttribution.set(key, String(params[key]));
      }
      return { event, params: sanitizeAttribution(rawAttribution) };
    }
    case 'onboarding_completed':
    case 'exam_started':
    case 'exam_submitted':
    case 'exam_room_joined':
    case 'tutor_used':
      return { event, params: {} };
    case 'donation_step':
      return oneOf(params.step, DONATION_STEPS) ? { event, params: { step: params.step } } : null;
    case 'donation_error':
      return oneOf(params.step, DONATION_STEPS)
        && oneOf(params.category, ['validation', 'file_validation', 'upload', 'rate_limit', 'server'] as const)
        && (params.field === undefined || oneOf(params.field, DONATION_FIELDS))
        ? { event, params: { step: params.step, category: params.category, ...(params.field ? { field: params.field } : {}) } } : null;
    case 'consent_choice':
      return params.choice === 'all' && oneOf(params.app, ['manager', 'student', 'landing'] as const)
        ? { event, params: { choice: 'all', app: params.app } } : null;
    case 'error_view':
      return oneOf(params.kind, ['forbidden', 'not_found', 'unexpected'] as const)
        && oneOf(params.app, ['manager', 'student', 'landing'] as const)
        ? { event, params: { kind: params.kind, app: params.app } } : null;
    case 'exam_abandoned':
      return params.app === 'student' ? { event, params: { app: 'student' } } : null;
    case 'scroll_depth':
      // Só a landing mede o scroll (docs/analytics-events.md): no gestor e no aluno é rejeitado.
      return params.app === 'landing'
        && oneOf(params.page, PAGES.landing)
        && [25, 50, 75, 100].includes(Number(params.depth))
        ? { event, params: { app: 'landing', page: params.page, depth: Number(params.depth) } } : null;
    default:
      return null;
  }
}

export function safePageLocation(app: AnalyticsApp, page: AnalyticsPage, origin: string): string {
  const path = PATHS[app][page] ?? PATHS[app].other!;
  try {
    return new URL(path, origin).origin + path;
  } catch {
    return `https://kixi.invalid${path}`;
  }
}

/** Keep GA's global page context canonical for any tag-generated history event. */
export function setSafePageContext(app: AnalyticsApp, pathname: string): void {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return;
  const page = pageForPath(app, pathname);
  const location = safePageLocation(app, page, window.location.origin);
  // Se o consentimento não for 'all', forçar page_location a uma rota neutra e referrer vazio
  // para que nenhum dado de navegação real fique exposto no contexto global do GA4.
  if (readConsent() !== 'all') {
    window.gtag('set', { page_location: `${window.location.origin}/`, page_referrer: '' });
    return;
  }
  window.gtag('set', { page_location: location, page_referrer: '' });
}

/** Limpa o contexto global de página do GA4 quando não há consentimento ativo. */
export function clearSafePageContext(): void {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return;
  window.gtag('set', { page_location: `${window.location.origin}/`, page_referrer: '' });
}

export function createAnalyticsQueue(options: QueueOptions) {
  const limit = options.maxPending ?? MAX_PENDING_ANALYTICS_EVENTS;
  const pending: { event: AnalyticsEvent; params: AnalyticsParams }[] = [];

  function clear() { pending.length = 0; }

  function send(item: { event: AnalyticsEvent; params: AnalyticsParams }, gtag: Gtag) {
    const params = { ...item.params };
    const origin = options.getOrigin();
    const pathname = new URL(options.getPathname?.() ?? '/', origin).pathname;
    const app: AnalyticsApp = pathname.startsWith('/aluno/') || pathname === '/aluno'
      ? 'student'
      : pathname.startsWith('/manager/') || pathname === '/manager'
        ? 'manager'
        : 'landing';
    const page = item.event === 'page_view'
      ? item.params.page as AnalyticsPage
      : pageForPath(app, pathname);
    const locationApp = item.event === 'page_view' ? item.params.app as AnalyticsApp : app;
    // GA can attach the browser URL to any event. Always override it with a
    // canonical route and suppress referrer so queries and fragments never leak.
    params.page_location = safePageLocation(locationApp, page, origin);
    params.page_referrer = '';
    gtag('event', item.event, params);
  }

  function track(eventName: string, params: AnalyticsParams = {}): TrackStatus {
    if (!options.hasConsent()) {
      clear();
      // Garantir que o contexto global do GA4 não retenha dados de navegação
      // quando o consentimento não está ativo.
      if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
        clearSafePageContext();
      }
      return 'denied';
    }
    const item = sanitizeEvent(eventName, params);
    if (!item) return 'invalid';
    const gtag = options.getGtag();
    if (gtag) {
      try { send(item, gtag); return 'sent'; } catch { /* retain for one later flush */ }
    }
    if (pending.length >= limit) {
      options.onOverflow?.();
      return 'overflow';
    }
    pending.push(item);
    return 'queued';
  }

  function flush(): number {
    if (!options.hasConsent()) {
      clear();
      if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
        clearSafePageContext();
      }
      return 0;
    }
    const gtag = options.getGtag();
    if (!gtag) return 0;
    let sent = 0;
    while (pending.length) {
      try {
        send(pending[0], gtag);
        pending.shift();
        sent++;
      } catch {
        break;
      }
    }
    if (sent && pending.length === 0) options.onDrained?.();
    return sent;
  }

  return { track, flush, clear, pendingCount: () => pending.length };
}

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

const queue = createAnalyticsQueue({
  // Sem `NEXT_PUBLIC_GA_ID` o `gtag` nunca é carregado: os eventos ficam na fila em memória (limitada) e não saem.
  hasConsent: () => typeof window !== 'undefined' && readConsent() === 'all',
  getGtag: () => typeof window !== 'undefined' && typeof window.gtag === 'function'
    ? window.gtag as unknown as Gtag : undefined,
  getOrigin: () => typeof window !== 'undefined' ? window.location.origin : 'https://kixi.invalid',
  getPathname: () => typeof window !== 'undefined' ? window.location.pathname : '/',
  onOverflow: () => { if (process.env.NODE_ENV !== 'production') console.warn('[analytics] fila em memória cheia; evento não aceite'); },
  onDrained: () => { if (typeof window !== 'undefined') window.dispatchEvent(new Event(ANALYTICS_READY_EVENT)); },
});

/** Só aceita nomes do contrato; parâmetros fora do schema são descartados por `sanitizeEvent`. */
export function track(event: AnalyticsEvent, params: AnalyticsParams = {}): TrackStatus {
  return queue.track(event, params);
}
export function flushAnalytics(): number { return queue.flush(); }
export function clearAnalyticsQueue(): void { queue.clear(); }
