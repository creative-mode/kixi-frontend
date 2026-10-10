import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';
import { getJwtSecret } from '@/lib/jwt';
import { resolveOrigin } from '@/lib/origin';
import { canAccessManager, isStudentOnly, normalizeRoles, type Role } from '@/lib/roles';

/** Rotas de administração: só o ADMIN as abre (contas, papéis, escolas, etc.). */
const ADMIN_ONLY_ROUTES = [
  '/school-year',
  '/terms',
  '/subjects',
  '/courses',
  '/institutions',
  '/teachers',
  '/teaching-assignments',
  '/enrollments',
  '/roles',
  '/accounts',
  '/users',
  '/sessions',
];

/** Rotas que o professor pode abrir; tudo o resto da gestão é-lhe vedado. */
const TEACHER_ROUTES = ['/professor', '/statements', '/simulations', '/simulation-answers'];

/** O professor consulta turmas, não as altera: `/classes` abre a lista, mas
 * `/classes/new` e `/classes/{id}/edit` continuam só para ADMIN. Sem esta
 * distinção ele abre o formulário e só descobre o bloqueio ao gravar. */
const TEACHER_EXACT_ROUTES = ['/classes'];

function publicOrigin(request: NextRequest) {
  // Configuração antes do pedido: `Host` e `x-forwarded-host` são escolhidos por quem
  // faz o pedido, e um redireccionamento construído a partir deles é um open redirect.
  // Ver lib/origin.ts.
  return resolveOrigin(request.headers, request.nextUrl.protocol) ?? new URL(request.url).origin;
}

function redirectTo(path: string, request: NextRequest, query?: Record<string, string>) {
  const url = request.nextUrl.clone();
  const origin = new URL(publicOrigin(request));
  url.protocol = origin.protocol;
  url.host = origin.host;
  url.pathname = path;
  url.search = '';
  for (const [key, value] of Object.entries(query ?? {})) {
    url.searchParams.set(key, value);
  }
  return url;
}

function isRoute(pathname: string, route: string) {
  return pathname === route || pathname.startsWith(`${route}/`);
}

function isAdminOnlyRoute(pathname: string) {
  return ADMIN_ONLY_ROUTES.some((route) => isRoute(pathname, route));
}

function isTeacherRoute(pathname: string) {
  return (
    TEACHER_EXACT_ROUTES.includes(pathname) ||
    TEACHER_ROUTES.some((route) => isRoute(pathname, route))
  );
}

function rolesFromPayload(value: unknown): Role[] {
  return normalizeRoles(value);
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isLoginRoute = isRoute(pathname, '/login');
  const isForbiddenRoute = isRoute(pathname, '/403');

  if (isLoginRoute || isForbiddenRoute) {
    if (isForbiddenRoute) return NextResponse.next();

    const token = request.cookies.get('auth_token')?.value;
    if (!token) return NextResponse.next();

    try {
      const { payload } = await jwtVerify(token, getJwtSecret());
      const roles = rolesFromPayload(payload.roles);

      if (canAccessManager(roles)) {
        if (roles.includes('TEACHER') && !roles.includes('ADMIN')) {
          return NextResponse.redirect(redirectTo('/professor', request));
        }
        return NextResponse.redirect(redirectTo('/', request));
      }

      if (isStudentOnly(roles)) {
        return NextResponse.redirect(redirectTo('/403', request, { reason: 'student-manager' }));
      }
    } catch {
      // Token inválido — deixa ver a página de login
      return NextResponse.next();
    }

    return NextResponse.next();
  }

  const token = request.cookies.get('auth_token')?.value;
  if (!token) {
    return NextResponse.redirect(redirectTo('/login', request, { reason: 'required' }));
  }

  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    const roles = rolesFromPayload(payload.roles);

    if (isStudentOnly(roles)) {
      return NextResponse.redirect(redirectTo('/403', request, { reason: 'student-manager' }));
    }

    if (!canAccessManager(roles)) {
      const response = NextResponse.redirect(
        redirectTo('/login', request, { reason: 'invalid-session' }),
      );
      response.cookies.delete('auth_token');
      response.cookies.delete('user_info');
      return response;
    }

    const isTeacher = roles.includes('TEACHER') && !roles.includes('ADMIN');
    // O professor não entra na gestão (contas, papéis, escolas…): acesso negado com motivo.
    if (isTeacher && isAdminOnlyRoute(pathname)) {
      return NextResponse.redirect(redirectTo('/403', request, { reason: 'role' }));
    }
    // Fora das suas páginas (e do exam-builder), volta à sua área.
    if (isTeacher && !isTeacherRoute(pathname) && !isRoute(pathname, '/exam-builder')) {
      return NextResponse.redirect(redirectTo('/professor', request));
    }

    const response = NextResponse.next();
    response.headers.set('x-user-id', String(payload.sub ?? ''));
    response.headers.set('x-user-roles', JSON.stringify(roles));
    return response;
  } catch {
    const response = NextResponse.redirect(redirectTo('/login', request, { reason: 'session-expired' }));
    response.cookies.delete('auth_token');
    response.cookies.delete('user_info');
    return response;
  }
}

export const config = {
  matcher: [
    '/',
    '/((?!_next|api|favicon.ico|manifest.json|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|css|js|woff|woff2|ttf|eot|json|ico)$).*)',
  ],
};
