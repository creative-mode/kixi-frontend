import { NextResponse, type NextRequest } from 'next/server';
import { managerUrl as configuredManagerUrl, resolveOrigin } from '@/lib/origin';

/** Public: the two entrance screens. Everything else needs a live session. */
const PUBLIC = ['/entrar', '/cadastro'];
/** O manager vive no mesmo endereço, em /manager (fora do basePath deste app). */
/** Atrás do gateway/Docker o origin visto pelo Next é o interno: usa o endereço público
 *  (configuração primeiro, cabeçalhos do gateway como recurso). */
function publicOrigin(req: NextRequest) {
  const configured = resolveOrigin(req.headers, req.nextUrl.protocol);
  return configured ?? new URL(req.nextUrl.href).origin;
}
const managerUrl = (req: NextRequest) => configuredManagerUrl() ?? new URL('/manager', publicOrigin(req)).toString();
/** Redireciona dentro deste app (mantém o basePath /aluno). */
function go(req: NextRequest, pathname: string) {
  const url = req.nextUrl.clone();
  url.host = new URL(publicOrigin(req)).host;
  url.protocol = new URL(publicOrigin(req)).protocol;
  url.pathname = pathname;
  return NextResponse.redirect(url);
}

function roles(token?: string): string[] | null {
  if (!token) return null;
  try {
    const p = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    if (typeof p.exp === 'number' && p.exp * 1000 < Date.now()) return null;
    const list = Array.isArray(p.roles) ? p.roles : [];
    // Sem papéis reconhecidos a sessão não serve: trata-a como "sem sessão"
    // para o utilizador ir ao login em vez de ficar num loop 403 ↔ início.
    return list.length > 0 ? list : null;
  } catch {
    return null;
  }
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const r = roles(req.cookies.get('auth_token')?.value);
  // A página 403 é uma tela estática do manual: segura de mostrar a qualquer
  // visitante (paridade com o manager, que também deixa abrir /403 sem sessão).
  if (pathname === '/403' || pathname.startsWith('/403/')) return NextResponse.next();
  const isPublic = PUBLIC.some((p) => pathname === p || pathname.startsWith(p + '/'));

  if (isPublic) {
    if (r) return (r.includes('ADMIN') ? NextResponse.redirect(managerUrl(req)) : go(req, '/inicio'));
    return NextResponse.next();
  }
  if (!r) return go(req, '/entrar');
  if (r.includes('ADMIN')) return NextResponse.redirect(managerUrl(req));
  return NextResponse.next();
}

export const config = { matcher: ['/((?!_next|favicon.ico|.*\\..*).*)'] };
