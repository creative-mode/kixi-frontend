import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';
import { getJwtSecret } from '@/lib/jwt';
import { resolveOrigin } from '@/lib/origin';
import { canAccessManager, isStudentOnly, normalizeRoles, teacherRoute, type Role } from '@/lib/roles';
import { appRelativePath, MANAGER_BASE_PATH, managerNext } from '@/lib/safe-next';

/**
 * A origem de confiança, ou null quando não há nenhuma.
 *
 * Configuração antes do pedido: `Host` e `x-forwarded-host` são escolhidos por quem faz o
 * pedido, e um redireccionamento construído a partir deles é um open redirect. Em produção
 * `resolveOrigin` recusa sem `APP_ORIGIN`, por isso este null só acontece em desenvolvimento.
 */
function publicOrigin(request: NextRequest): string | null {
  return resolveOrigin(request.headers, request.nextUrl.protocol);
}

/**
 * A porta vai também, e não só o nome: `url.host` deixa a porta que o Next já tinha, que
 * por trás do gateway é a interna da app. Com `APP_ORIGIN=https://kixi.ao`, sem porta, isso
 * dava `https://kixi.ao:3002/...` e nenhuma visita sem sessão chegava ao gestor.
 * `URL.port` é uma string vazia quando a origem não tem porta, e atribuí-la limpa a que
 * lá estava.
 */
function redirectTo(path: string, request: NextRequest, query?: Record<string, string>) {
  const url = request.nextUrl.clone();
  const origin = publicOrigin(request);
  if (origin) {
    const alvo = new URL(origin);
    url.protocol = alvo.protocol;
    url.host = alvo.host;
    url.port = alvo.port;
  }
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

function rolesFromPayload(value: unknown): Role[] {
  return normalizeRoles(value);
}

/** O caminho público que o utilizador tentou abrir, para voltar a ele depois de entrar. */
function requestedPath(request: NextRequest): string {
  return `${request.nextUrl.pathname}${request.nextUrl.search}`;
}

function nextAfterLogin(request: NextRequest): string {
  const next = managerNext(requestedPath(request));
  return next ? appRelativePath(next, MANAGER_BASE_PATH) : '/';
}

function loginQuery(request: NextRequest, reason: string): Record<string, string> {
  const next = managerNext(requestedPath(request));
  return { reason, ...(next ? { next } : {}) };
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isLoginRoute = isRoute(pathname, '/login');
  const isForbiddenRoute = isRoute(pathname, '/403');
  const isRecoveryRoute = isRoute(pathname, '/recuperar');

  if (isLoginRoute || isForbiddenRoute || isRecoveryRoute) {
    if (isForbiddenRoute || isRecoveryRoute) return NextResponse.next();

    const token = request.cookies.get('auth_token')?.value;
    if (!token) return NextResponse.next();

    try {
      const { payload } = await jwtVerify(token, getJwtSecret());
      const roles = rolesFromPayload(payload.roles);

      if (canAccessManager(roles)) {
        if (roles.includes('TEACHER') && !roles.includes('ADMIN')) {
          return NextResponse.redirect(redirectTo('/professor', request));
        }
        return NextResponse.redirect(redirectTo(nextAfterLogin(request), request));
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
    return NextResponse.redirect(redirectTo('/login', request, loginQuery(request, 'required')));
  }

  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    const roles = rolesFromPayload(payload.roles);

    if (isStudentOnly(roles)) {
      return NextResponse.redirect(redirectTo('/403', request, { reason: 'student-manager' }));
    }

    if (!canAccessManager(roles)) {
      const response = NextResponse.redirect(
        redirectTo('/login', request, loginQuery(request, 'invalid-session')),
      );
      response.cookies.delete('auth_token');
      response.cookies.delete('user_info');
      return response;
    }

    // O professor tem uma lista fechada de rotas (`teacherRoute`, com testes): a
    // gestão dá 403 com motivo, e o resto volta ao início dele.
    if (roles.includes('TEACHER') && !roles.includes('ADMIN')) {
      const decision = teacherRoute(pathname);
      if (decision === 'forbidden') {
        return NextResponse.redirect(redirectTo('/403', request, { reason: 'role' }));
      }
      if (decision === 'home') {
        return NextResponse.redirect(redirectTo('/professor', request));
      }
    }

    const response = NextResponse.next();
    response.headers.set('x-user-id', String(payload.sub ?? ''));
    response.headers.set('x-user-roles', JSON.stringify(roles));
    return response;
  } catch {
    const response = NextResponse.redirect(redirectTo('/login', request, loginQuery(request, 'session-expired')));
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
