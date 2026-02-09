'use server'

import { cookies, headers } from 'next/headers'
import { jwtVerify } from 'jose'
import { cache } from 'react'

const SECRET_KEY = new TextEncoder().encode(process.env.JWT_SECRET || 'default-secret-key')

export interface CurrentUser {
    id: number
    email: string
    name: string | null
    role: string
    isActive: boolean
    isVerified: boolean
}

/**
 * Get the current user from the session cookie
 * Uses JWT token data directly (user comes from external auth: auth.kixi.ao)
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
    try {
        const cookieStore = await cookies()
        const sessionCookie = cookieStore.get('session')

        if (!sessionCookie) {
            return null
        }

        // Verify JWT token
        const { payload } = await jwtVerify(sessionCookie.value, SECRET_KEY)

        if (!payload.userId) {
            return null
        }

        // Check expiration
        if (payload.exp && Date.now() >= (payload.exp as number) * 1000) {
            return null
        }

        // Return user data from token (external auth service)
        return {
            id: payload.userId as number,
            email: (payload.email as string) || '',
            name: (payload.name as string) || null,
            role: (payload.role as string) || 'COMMON',
            isActive: true,
            isVerified: true,
        }
    } catch (error) {
        console.error('Error getting current user:', error)
        return null
    }
})

/**
 * Get the current user ID from headers (set by middleware)
 * This is faster than decoding the JWT again
 */
export async function getCurrentUserId(): Promise<number | null> {
    const headersList = await headers()
    const userId = headersList.get('x-user-id')
    return userId ? parseInt(userId, 10) : null
}

/**
 * Get the current user role from headers (set by middleware)
 */
export async function getCurrentUserRole(): Promise<string | null> {
    const headersList = await headers()
    return headersList.get('x-user-role')
}

/**
 * Check if the current user is an admin
 */
export async function isAdmin(): Promise<boolean> {
    const role = await getCurrentUserRole()
    return role === 'ADMIN'
}

/**
 * Require authentication - throws if user is not logged in
 */
export async function requireAuth(): Promise<CurrentUser> {
    const user = await getCurrentUser()

    if (!user) {
        throw new Error('Authentication required')
    }

    return user
}

/**
 * Require admin access - throws if user is not an admin
 */
export async function requireAdmin(): Promise<CurrentUser> {
    const user = await requireAuth()

    if (user.role !== 'ADMIN') {
        throw new Error('Admin access required')
    }

    return user
}
