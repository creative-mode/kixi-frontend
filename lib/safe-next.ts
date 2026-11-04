/**
 * Validação de destinos internos (`?next=`), partilhada pelo login, pelo proxy e pelas
 * server actions. Um destino vindo do endereço é escolhido por quem faz o pedido: aceitá-lo
 * sem verificar é um open redirect.
 *
 * A regra é simples: o resultado tem sempre de ficar dentro do `basePath` desta aplicação.
 * Tudo o que tenha esquema (`https://`, `javascript:`), comece por `//`, traga barras
 * invertidas, caracteres de controlo ou escape por codificação é rejeitado.
 */

export const MANAGER_BASE_PATH = '/manager';

/** Rotas que nunca são destino de regresso: autenticação, erro e a própria recuperação. */
export const MANAGER_BLOCKED_NEXT = ['/login', '/403', '/recuperar', '/api'] as const;

export interface SafeNextOptions {
  basePath: string;
  blocked?: readonly string[];
  maxLength?: number;
}

const MAX_LENGTH = 2048;
const CONTROL_OR_BACKSLASH = /[\u0000-\u001f\u007f\\]/;
const SCHEME = /^[a-zA-Z][a-zA-Z0-9+.-]*:/;

/** Descodifica até três níveis, para apanhar `%252F%252Fevil.com` e semelhantes. */
function fullyDecoded(value: string): string | null {
  let current = value;
  for (let i = 0; i < 3; i++) {
    let next: string;
    try {
      next = decodeURIComponent(current);
    } catch {
      return null;
    }
    if (next === current) return current;
    current = next;
  }
  return current;
}

function isBlocked(relative: string, blocked: readonly string[]): boolean {
  return blocked.some((route) => relative === route || relative.startsWith(`${route}/`));
}

/**
 * Devolve o destino normalizado, com o `basePath` incluído, ou `null` se não for seguro.
 * Aceita tanto caminhos públicos (`/manager/x`) como caminhos relativos à aplicação (`/x`).
 */
export function safeInternalNext(raw: unknown, options: SafeNextOptions): string | null {
  if (typeof raw !== 'string') return null;
  const value = raw.trim();
  if (!value || value.length > (options.maxLength ?? MAX_LENGTH)) return null;
  if (CONTROL_OR_BACKSLASH.test(value)) return null;
  if (SCHEME.test(value)) return null;
  if (!value.startsWith('/') || value.startsWith('//')) return null;

  const decoded = fullyDecoded(value);
  if (decoded === null) return null;
  if (CONTROL_OR_BACKSLASH.test(decoded) || SCHEME.test(decoded) || decoded.startsWith('//')) return null;

  // A codificação não pode esconder segmentos de navegação: `%2F` não é uma barra para
  // o parser de URL, mas muitos clientes/proxies descodificam-no antes de navegar.
  const decodedPath = fullyDecoded(value.split(/[?#]/, 1)[0]);
  if (decodedPath === null) return null;
  if (decodedPath.includes('//') || decodedPath.includes('..') || decodedPath.includes('\\')) return null;

  let parsed: URL;
  try {
    parsed = new URL(value, 'http://kixi.invalid');
  } catch {
    return null;
  }
  if (parsed.origin !== 'http://kixi.invalid') return null;

  const basePath = options.basePath.replace(/\/$/, '');
  const underBase = parsed.pathname === basePath || parsed.pathname.startsWith(`${basePath}/`);
  const publicPath = underBase
    ? parsed.pathname
    : `${basePath}${parsed.pathname === '/' ? '' : parsed.pathname}`;
  const normalized = publicPath === basePath ? `${basePath}/` : publicPath;

  if (normalized !== `${basePath}/` && !normalized.startsWith(`${basePath}/`)) return null;
  if (normalized.startsWith(`${basePath}${basePath}/`)) return null;

  const relative = normalized.slice(basePath.length) || '/';
  if (isBlocked(relative, options.blocked ?? [])) return null;

  return `${normalized}${parsed.search}`;
}

/** O caminho relativo à aplicação, para `router.push`/`redirect` do Next. */
export function appRelativePath(publicPath: string, basePath: string): string {
  const base = basePath.replace(/\/$/, '');
  if (publicPath === base) return '/';
  if (publicPath.startsWith(`${base}/`)) return publicPath.slice(base.length);
  return publicPath;
}

/** Atalho do gestor: destino interno seguro ou `null`. */
export function managerNext(raw: unknown): string | null {
  return safeInternalNext(raw, { basePath: MANAGER_BASE_PATH, blocked: MANAGER_BLOCKED_NEXT });
}

/** O caminho público desta app a partir do caminho visto pelo proxy. */
export function managerPath(pathname: string, search = ''): string {
  return `${MANAGER_BASE_PATH}${pathname === '/' ? '' : pathname}${search}`;
}
