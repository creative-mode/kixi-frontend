'use server';

import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { parseISO } from 'date-fns';

const NewsSchema = z.object({
    title: z.string().min(1, 'Title is required'),
    content: z.string().min(1, 'Content is required'),
    coverUrl: z.string().optional(),
    scheduledAt: z.string().optional().nullable(),
});

export async function getNews(query?: string) {
    try {
        const where = query
            ? {
                OR: [
                    { title: { contains: query, mode: 'insensitive' as const } },
                    { content: { contains: query, mode: 'insensitive' as const } },
                ],
            }
            : {};

        const news = await prisma.news.findMany({
            where,
            orderBy: { publishedAt: 'desc' },
        });
        return news;
    } catch (error) {
        console.error('Error fetching news:', error);
        return [];
    }
}

export async function getNewsById(id: number) {
    try {
        const news = await prisma.news.findUnique({
            where: { id },
        });
        return news;
    } catch (error) {
        console.error('Error fetching news:', error);
        return null;
    }
}

function generateSlug(title: string): string {
    return title
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '');
}

export async function createNews(formData: FormData) {
    try {
        const data = Object.fromEntries(formData.entries());
        const parsed = NewsSchema.safeParse(data);

        if (!parsed.success) {
            return { success: false, error: 'Dados inválidos' };
        }

        const validated = parsed.data;
        const slug = `${generateSlug(validated.title)}-${Date.now()}`;

        let publishedAt = new Date();
        if (validated.scheduledAt) {
            publishedAt = parseISO(validated.scheduledAt);
        }

        await prisma.news.create({
            data: {
                title: validated.title,
                slug,
                content: validated.content,
                coverUrl: validated.coverUrl || null,
                scheduledAt: publishedAt,
                publishedAt: publishedAt,
            },
        });

        revalidatePath('/news'); // Revalidate main app news page
        revalidatePath('/manager/news'); // Revalidate manager news page

        return { success: true };
    } catch (error) {
        console.error('Error creating news:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Failed to create news' };
    }
}

export async function updateNews(id: number, formData: FormData) {
    try {
        const data = Object.fromEntries(formData.entries());
        const parsed = NewsSchema.safeParse(data);

        if (!parsed.success) {
            return { success: false, error: 'Dados inválidos' };
        }

        const validated = parsed.data;

        let publishedAt = new Date();
        if (validated.scheduledAt) {
            publishedAt = parseISO(validated.scheduledAt);
        }

        await prisma.news.update({
            where: { id },
            data: {
                title: validated.title,
                content: validated.content,
                coverUrl: validated.coverUrl || null,
                scheduledAt: publishedAt,
                publishedAt: publishedAt,
            },
        });

        revalidatePath('/news'); // Revalidate main app news page
        revalidatePath('/manager/news'); // Revalidate manager news page

        return { success: true };
    } catch (error) {
        console.error('Error updating news:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Failed to update news' };
    }
}

export async function deleteNews(id: number) {
    try {
        await prisma.news.delete({ where: { id } });
        revalidatePath('/news');
        revalidatePath('/manager/news');
        return { success: true };
    } catch (error) {
        console.error('Error deleting news:', error);
        return { success: false, error: 'Failed to delete news' };
    }
}
