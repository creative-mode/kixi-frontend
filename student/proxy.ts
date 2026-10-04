import { NextResponse, type NextRequest } from 'next/server';

/** Public: the two entrance screens. Everything else needs a live session. */
const PUBLIC = ['/entrar', '/cadastro'];
const MANAGER_URL = process.env.NEXT_PUBLIC_MANAGER_URL ?? 'http://localhost:3002/manager';

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
    if (r) return NextResponse.redirect(r.includes('ADMIN') ? MANAGER_URL : new URL('/inicio', req.url));
    return NextResponse.next();
  }
  if (!r) return NextResponse.redirect(new URL('/entrar', req.url));
  if (r.includes('ADMIN')) return NextResponse.redirect(MANAGER_URL);
  return NextResponse.next();
}

export const config = { matcher: ['/((?!_next|favicon.ico|.*\\..*).*)'] };
