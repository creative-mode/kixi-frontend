'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

const ServiceSchema = z.object({
    num: z.string(),
    title: z.string(),
    description: z.string(),
    tags: z.string(),
});

export async function updateService(id: number, formData: FormData) {
    const data = Object.fromEntries(formData.entries());
    const parsed = ServiceSchema.safeParse(data);

    if (!parsed.success) {
        return { error: 'Invalid data' };
    }

    const tags = parsed.data.tags.split(',').map((t) => t.trim());

    try {
        await prisma.service.update({
            where: { id },
            data: {
                num: parsed.data.num,
                title: parsed.data.title,
                description: parsed.data.description,
                tags: tags,
            },
        });
        revalidatePath('/manager/services');
        return { success: true };
    } catch (error) {
        return { error: 'Failed to update service' };
    }
}

export async function createService(formData: FormData) {
    const data = Object.fromEntries(formData.entries());
    const parsed = ServiceSchema.safeParse(data);

    if (!parsed.success) {
        return { error: 'Invalid data' };
    }

    const tags = parsed.data.tags.split(',').map((t) => t.trim());

    try {
        await prisma.service.create({
            data: {
                num: parsed.data.num,
                title: parsed.data.title,
                description: parsed.data.description,
                tags: tags,
            },
        });
        revalidatePath('/manager/services');
        return { success: true };
    } catch (error) {
        return { error: 'Failed to create service' };
    }
}

export async function deleteService(id: number) {
    try {
        await prisma.service.delete({ where: { id } });
        revalidatePath('/manager/services');
        return { success: true };
    } catch (error) {
        return { error: 'Failed to delete service' };
    }
}

export async function getServices() {
    return await prisma.service.findMany({ orderBy: { num: 'asc' } });
}

export async function getServiceById(id: number) {
    try {
        const service = await prisma.service.findUnique({
            where: { id },
        });
        return service;
    } catch (error) {
        console.error('Error fetching service:', error);
        return null;
    }
}
