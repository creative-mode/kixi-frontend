'use server';

import { prisma } from '@/lib/prisma';

export async function getContacts(query?: string) {
    try {
        const where = query
            ? {
                OR: [
                    { name: { contains: query, mode: 'insensitive' as const } },
                    { email: { contains: query, mode: 'insensitive' as const } },
                    { subject: { contains: query, mode: 'insensitive' as const } },
                    { message: { contains: query, mode: 'insensitive' as const } },
                ],
            }
            : {};

        const contacts = await prisma.contact.findMany({
            where,
            orderBy: { createdAt: 'desc' },
        });
        return contacts;
    } catch (error) {
        console.error('Error fetching contacts:', error);
        return [];
    }
}
