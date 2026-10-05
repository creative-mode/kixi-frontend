import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { jwtVerify } from 'jose'
import { getJwtSecret } from '@/lib/jwt'

/**
 * Next.js 16 proxy convention — replaces middleware.ts.
 *
 * With basePath: '/manager' in next.config.ts, the proxy receives
 * pathnames WITHOUT the prefix (/manager/login → /login). Cloning nextUrl keeps the basePath,
 * so the redirects below only set the unprefixed pathname.
 */

/** nextUrl already carries the basePath separately: setting pathname adds the prefix, so do not add it again. */
function redirectTo(path: string, request: NextRequest) {
  const url = request.nextUrl.clone()
  // Atrás do gateway/Docker o origin visto pelo Next é o interno (0.0.0.0:3002): usa o endereço público.
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host')
  if (host) {
    url.host = host
    url.protocol = request.headers.get('x-forwarded-proto') ?? url.protocol
  }
  url.pathname = path
  url.search = ''
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
      // A valid student session is shared with the aluno app (same cookie): send them to the login, but keep it.
      return NextResponse.redirect(redirectTo('/login', request))
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
    // With a basePath the dashboard (/manager) reaches the proxy as an empty path, which the pattern below misses: list it explicitly.
    '/',
    '/((?!_next|api|favicon.ico|manifest.json|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|css|js|woff|woff2|ttf|eot|json|ico)$).*)',
  ],
}
