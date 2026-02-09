'use server';

import { prisma } from '@/lib/prisma';
import { SignJWT } from 'jose';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import bcrypt from 'bcryptjs';

const SECRET_KEY = new TextEncoder().encode(process.env.JWT_SECRET || 'default-secret-key');

export async function loginAction(formData: FormData) {
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    if (!email || !password) {
        return { error: 'Email and password are required' };
    }

    try {
        // Try external API first if configured
        const externalApiUrl = process.env.EXTERNAL_AUTH_URL || 'https://auth.techify.ao/api/auth/external/login';
        let user = null;

        try {
            const response = await fetch(externalApiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, password }),
                signal: AbortSignal.timeout(5000), // 5 second timeout
            });

            if (response.ok) {
                const externalData = await response.json();

                if (externalData.success && externalData.user?.role === 'ADMIN') {
                    const hashedPassword = await bcrypt.hash(password, 10);

                    user = await prisma.user.upsert({
                        where: { email },
                        update: {
                            role: 'ADMIN',
                            isActive: true,
                            isVerified: true,
                            name: externalData.user.name,
                            password: hashedPassword,
                        },
                        create: {
                            email,
                            name: externalData.user.name,
                            password: hashedPassword,
                            role: 'ADMIN',
                            isActive: true,
                            isVerified: true,
                        },
                    });
                }
            }
        } catch (externalError) {
            console.log('External auth unavailable, trying local auth:', externalError);
        }

        // Fallback to local authentication
        if (!user) {
            const localUser = await prisma.user.findUnique({
                where: { email },
            });

            if (!localUser) {
                return { error: 'Invalid email or password' };
            }

            const isPasswordValid = await bcrypt.compare(password, localUser.password);
            if (!isPasswordValid) {
                return { error: 'Invalid email or password' };
            }

            if (!localUser.isActive) {
                return { error: 'User account is inactive' };
            }

            user = localUser;
        }

        // Generate Session/Token
        const token = await new SignJWT({
            userId: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
        })
            .setProtectedHeader({ alg: 'HS256' })
            .setIssuedAt()
            .setExpirationTime('24h')
            .sign(SECRET_KEY);

        const cookieStore = await cookies();
        cookieStore.set('session', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 60 * 60 * 24, // 24 hours
            path: '/',
        });

        return { success: true };
    } catch (error) {
        console.error('Login error:', error);
        return { error: 'An unexpected error occurred' };
    }
}

export async function logoutAction() {
    const cookieStore = await cookies();
    cookieStore.delete('session');
    redirect('/login');
}
