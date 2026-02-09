import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

const SECRET_KEY = new TextEncoder().encode(process.env.JWT_SECRET || 'default-secret-key')

export async function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl
    const method = request.method

    // With basePath: '/manager', internal paths don't include the prefix
    // So '/manager/login' appears as '/login' internally
    // '/manager/comments' appears as '/comments' internally
    const publicRoutes = ['/', '/login']

    // Allow public routes to pass through without authentication
    if (publicRoutes.includes(pathname)) {
        const response = NextResponse.next()
        response.headers.set('x-middleware-path', pathname)
        return response
    }

    // Allow RSC (React Server Component) segment requests
    // These are needed for page re-renders and navigation after login
    if (pathname.includes('.segments') || pathname.endsWith('.rsc')) {
        return NextResponse.next()
    }

    // Check for session cookie
    const sessionCookie = request.cookies.get('session')

    // Normalize pathname (remove trailing slash for checks)
    const normalizedPath = pathname.endsWith('/') && pathname.length > 1
        ? pathname.slice(0, -1)
        : pathname

    if (!sessionCookie) {
        // If no session and trying to access protected route, redirect to login
        // BUT: Allow GET requests that might be static or from middleware itself
        if (normalizedPath !== '/' && normalizedPath !== '/login' && method === 'GET') {
            const response = NextResponse.redirect(new URL('/login', request.url))
            response.headers.set('x-debug-cookie-missing', 'true')
            return response
        }
        // Allow other methods (POST, etc) to pass - they might be RSC requests or server actions
        return NextResponse.next()
    }

    try {
        // Verify JWT token
        const { payload } = await jwtVerify(sessionCookie.value, SECRET_KEY)

        // Explicitly check expiration
        if (payload.exp && Date.now() >= (payload.exp as number) * 1000) {
            console.error('Token expired')
            // Clear the invalid session
            const response = NextResponse.redirect(new URL('/login', request.url))
            response.cookies.delete({ name: 'session', path: '/' })
            response.headers.set('x-debug-token-expired', 'true')
            return response
        }

        // Check if user is admin (all manager routes require admin)
        if (payload.role !== 'ADMIN') {
            console.warn('User is not admin, redirecting')
            const response = NextResponse.redirect(new URL('/login', request.url))
            response.headers.set('x-debug-role-mismatch', String(payload.role))
            return response
        }

        // Add user info to headers for easy access in server components
        const response = NextResponse.next()
        response.headers.set('x-user-id', String(payload.userId || payload.id))
        response.headers.set('x-user-role', String(payload.role))
        response.headers.set('x-user-email', String(payload.email))
        response.headers.set('x-debug-auth-success', 'true')

        return response
    } catch (error) {
        console.error('JWT verification failed:', error)
        // Invalid token - redirect to login
        const response = NextResponse.redirect(new URL('/login', request.url))
        response.cookies.delete({ name: 'session', path: '/' })
        response.headers.set('x-debug-auth-error', 'verify-failed')
        return response
    }
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - api (API routes)
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - public folder and static assets
         */
        '/((?!api|_next|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|css|js|woff|woff2|ttf|eot|json)$).*)',
    ],
}
