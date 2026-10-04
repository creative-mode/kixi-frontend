import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

/**
 * Next.js 16 proxy convention — replaces middleware.ts.
 *
 * With basePath: '/manager' in next.config.ts, the proxy receives
 * pathnames WITHOUT the prefix:
 *   browser URL /manager/login  →  pathname = /login
 *   browser URL /manager/       →  pathname = /
 *
 * But NextResponse.redirect() needs the FULL URL including basePath,
 * so we use the redirectTo() helper below.
 */

function getJwtSecret() {
  const secret = process.env.JWT_SECRET || 'default-secret-change-in-production-min-256-bits'
  return new TextEncoder().encode(secret)
}

/**
 * Redirect inside the manager. NextURL already re-adds the basePath when it is
 * serialised, so the pathname must NOT include it (otherwise: /manager/manager/login).
 */
function redirectTo(path: string, request: NextRequest) {
  const url = request.nextUrl.clone()
  url.pathname = path
  return url
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // ── Public routes (no auth required) ──────────────────────────
  const isLoginRoute = pathname === '/login' || pathname.startsWith('/login/')

  if (isLoginRoute) {
    // If already authenticated as ADMIN, redirect away from login
    const token = request.cookies.get('auth_token')?.value
    if (token) {
      try {
        const { payload } = await jwtVerify(token, getJwtSecret())
        const roles = (payload.roles as string[]) || []
        if (roles.includes('ADMIN')) {
          return NextResponse.redirect(redirectTo('/', request))
        }
      } catch {
        // Token invalid — let them see login page
      }
    }
    return NextResponse.next()
  }

  // ── Protected routes — require valid auth_token cookie ────────
  const token = request.cookies.get('auth_token')?.value

  if (!token) {
    return NextResponse.redirect(redirectTo('/login', request))
  }

  try {
    const { payload } = await jwtVerify(token, getJwtSecret())

    // Expired token
    if (payload.exp && Date.now() >= payload.exp * 1000) {
      const response = NextResponse.redirect(redirectTo('/login', request))
      response.cookies.delete('auth_token')
      response.cookies.delete('user_info')
      return response
    }

    // Only ADMIN role can access Kixi Manager
    const roles = (payload.roles as string[]) || []
    if (!roles.includes('ADMIN')) {
      const response = NextResponse.redirect(redirectTo('/login', request))
      response.cookies.delete('auth_token')
      response.cookies.delete('user_info')
      return response
    }

    // Authenticated admin — forward with user info headers
    const response = NextResponse.next()
    response.headers.set('x-user-id', String(payload.sub))
    response.headers.set('x-user-roles', JSON.stringify(roles))
    return response
  } catch (error) {
    console.error('[proxy] JWT verification failed:', error)
    const response = NextResponse.redirect(redirectTo('/login', request))
    response.cookies.delete('auth_token')
    response.cookies.delete('user_info')
    return response
  }
}

export const config = {
  matcher: [
    '/((?!_next|api|favicon.ico|manifest.json|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|css|js|woff|woff2|ttf|eot|json|ico)$).*)',
  ],
}
