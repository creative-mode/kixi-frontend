import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';
import { getJwtSecret } from '@/lib/jwt';
import { canAccessManager, isStudentOnly, normalizeRoles, type Role } from '@/lib/roles';

const MANAGER_ONLY_ROUTES = ['/accounts', '/roles', '/users', '/sessions'];

function redirectTo(path: string, request: NextRequest, query?: Record<string, string>) {
  const url = request.nextUrl.clone();
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

function isManagerOnlyRoute(pathname: string) {
  return MANAGER_ONLY_ROUTES.some((route) => isRoute(pathname, route));
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
          return NextResponse.redirect(redirectTo('/exam-builder', request));
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
    if (isTeacher && !pathname.startsWith('/exam-builder')) {
      return NextResponse.redirect(redirectTo('/exam-builder', request));
    }

    if (roles.includes('TEACHER') && isManagerOnlyRoute(pathname)) {
      return NextResponse.redirect(redirectTo('/403', request, { reason: 'role' }));
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
