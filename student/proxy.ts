import { NextResponse, type NextRequest } from 'next/server';

/** Public: the two entrance screens. Everything else needs a live session. */
const PUBLIC = ['/entrar', '/cadastro'];
/** O manager vive no mesmo endereço, em /manager (fora do basePath deste app). */
const managerUrl = (req: NextRequest) => process.env.NEXT_PUBLIC_MANAGER_URL ?? new URL('/manager', req.url).toString();
/** Redireciona dentro deste app (mantém o basePath /aluno). */
function go(req: NextRequest, pathname: string) {
  const url = req.nextUrl.clone();
  url.pathname = pathname;
  return NextResponse.redirect(url);
}

function roles(token?: string): string[] | null {
  if (!token) return null;
  try {
    const p = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    if (typeof p.exp === 'number' && p.exp * 1000 < Date.now()) return null;
    return Array.isArray(p.roles) ? p.roles : [];
  } catch {
    return null;
  }
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const r = roles(req.cookies.get('auth_token')?.value);
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
