/**
 * Para onde vai quem abre a landing (`/`) com a sessão iniciada.
 *
 * O cookie `auth_token` é partilhado pelas três apps (o gateway serve tudo na mesma
 * origem, com `path: '/'`), por isso a landing consegue saber se há sessão e mandar cada
 * pessoa para a sua app em vez de lhe mostrar outra vez a página de apresentação.
 *
 * A assinatura não é verificada aqui, e não precisa de ser: isto só escolhe um destino. A
 * app de destino verifica o token como sempre fez, e um token forjado acaba no login dela,
 * não em conteúdo. Por isso a regra é a mesma que o `proxy.ts` do aluno já usa: um token
 * expirado ou sem papéis reconhecidos conta como «sem sessão» e a landing aparece.
 */

/** Espelho de `lib/roles.ts` (apps Next separadas, sem import partilhado). */
const ROLES = ['ADMIN', 'TEACHER', 'STUDENT'] as const;
type Role = (typeof ROLES)[number];

export const SESSION_COOKIE = 'auth_token';

export const STUDENT_HOME = '/aluno/inicio';
export const MANAGER_HOME = '/manager';

function decodePayload(token: string): Record<string, unknown> | null {
  const part = token.split('.')[1];
  if (!part) return null;
  try {
    const json = atob(part.replace(/-/g, '+').replace(/_/g, '/'));
    const payload: unknown = JSON.parse(json);
    return payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Os papéis de uma sessão ainda válida, ou null quando não há sessão que sirva. */
export function sessionRoles(token: string | undefined, now: number = Date.now()): Role[] | null {
  if (!token) return null;
  const payload = decodePayload(token);
  if (!payload) return null;
  if (typeof payload.exp === 'number' && payload.exp * 1000 <= now) return null;
  const roles = Array.isArray(payload.roles)
    ? payload.roles.filter((r): r is Role => typeof r === 'string' && ROLES.includes(r as Role))
    : [];
  return roles.length > 0 ? roles : null;
}

let missingManagerUrlWarned = false;

/** Avisa uma única vez por processo: o proxy corre em cada pedido à raiz. */
function warnMissingManagerUrl() {
  if (missingManagerUrlWarned) return;
  missingManagerUrlWarned = true;
  console.warn(
    '[landing] NEXT_PUBLIC_MANAGER_URL não está definido: sessões de gestor e professor ficam na landing em vez de seguirem para o gestor.',
  );
}

/**
 * O destino de quem tem sessão, ou null para mostrar a landing.
 *
 * Gestor e professor vão para o gestor (é ele que separa o professor para `/professor`);
 * quem é só aluno vai para o início do aluno, que por sua vez manda para o onboarding quem
 * ainda não tem turma. `managerUrl` é o `NEXT_PUBLIC_MANAGER_URL`, o endereço do host
 * isolado do gestor.
 *
 * Fora de produção, vazio quer dizer «na mesma origem» e vale `/manager`, para o `npm run
 * dev` funcionar sem configuração. Em produção não se assume nada: o gateway devolve 404 a
 * `/manager*` no domínio público (#541), e mandar para lá deixava gestores e professores
 * presos num 404 sem explicação. Sem `managerUrl` a landing aparece, que é o lado seguro, e
 * fica um aviso no log a dizer qual é a variável em falta.
 */
export function sessionDestination(
  token: string | undefined,
  managerUrl = '',
  now: number = Date.now(),
  production = false,
): string | null {
  const roles = sessionRoles(token, now);
  if (!roles) return null;
  if (roles.includes('ADMIN') || roles.includes('TEACHER')) {
    const configured = managerUrl.trim();
    if (configured) return configured;
    if (!production) return MANAGER_HOME;
    warnMissingManagerUrl();
    return null;
  }
  if (roles.length === 1 && roles[0] === 'STUDENT') return STUDENT_HOME;
  return null;
}

/**
 * A origem pública de onde se monta o redireccionamento, ou null para não redireccionar.
 *
 * Mesma regra de `lib/origin.ts` do gestor e do aluno: os cabeçalhos `Host` e
 * `x-forwarded-host` são escolhidos por quem faz o pedido, e um redireccionamento montado a
 * partir deles é um open redirect. Em produção vale só `APP_ORIGIN`; fora dela, o pedido,
 * para `npm run dev` funcionar sem configuração. Sem origem de confiança a landing aparece
 * normalmente, que é o lado seguro: ninguém fica preso numa página partida.
 */
export function redirectOrigin(
  appOrigin: string | undefined,
  headers: Headers,
  fallbackProtocol: string,
  production: boolean,
): string | null {
  const configured = appOrigin?.trim();
  if (configured) {
    try {
      return new URL(configured).origin;
    } catch {
      /* configuração inválida: tratada como ausente */
    }
  }
  if (production) return null;
  const host = headers.get('x-forwarded-host') ?? headers.get('host');
  if (!host) return null;
  const proto = headers.get('x-forwarded-proto') ?? fallbackProtocol.replace(':', '');
  try {
    return new URL(`${proto}://${host}`).origin;
  } catch {
    return null;
  }
}
