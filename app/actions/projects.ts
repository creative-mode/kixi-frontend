'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

const ProjectSchema = z.object({
    name: z.string(),
    description: z.string(),
    url: z.string(),
    imageUrl: z.string().optional(),
    features: z.string(),
    status: z.enum(['em_desenvolvimento', 'ativo', 'descontinuado']),
});

export async function updateProject(id: number, formData: FormData) {
    const data = Object.fromEntries(formData.entries());
    const parsed = ProjectSchema.safeParse(data);

    if (!parsed.success) {
        return { error: 'Invalid data' };
    }

    const features = parsed.data.features.split(',').map((f) => f.trim());

    try {
        await prisma.product.update({
            where: { id },
            data: {
                name: parsed.data.name,
                description: parsed.data.description,
                url: parsed.data.url,
                imageUrl: parsed.data.imageUrl || null,
                features: features,
                status: parsed.data.status as any,
            },
        });
        revalidatePath('/manager/projects');
        return { success: true };
    } catch (error) {
        return { error: 'Failed to update project' };
    }
}

export async function createProject(formData: FormData) {
    const data = Object.fromEntries(formData.entries());
    const parsed = ProjectSchema.safeParse(data);

    if (!parsed.success) {
        return { error: 'Invalid data' };
    }

    const features = parsed.data.features.split(',').map((f) => f.trim());

    try {
        await prisma.product.create({
            data: {
                name: parsed.data.name,
                description: parsed.data.description,
                url: parsed.data.url,
                imageUrl: parsed.data.imageUrl || null,
                features: features,
                status: parsed.data.status as any,
            },
        });
        revalidatePath('/manager/projects');
        return { success: true };
    } catch (error) {
        return { error: 'Failed to create project' };
    }
}

export async function deleteProject(id: number) {
    try {
        await prisma.product.delete({ where: { id } });
        revalidatePath('/manager/projects');
        return { success: true };
    } catch (error) {
        return { error: 'Failed to delete project' };
    }
}

export async function getProjects(query?: string) {
    const where = query
        ? {
            OR: [
                { name: { contains: query, mode: 'insensitive' as const } },
                { description: { contains: query, mode: 'insensitive' as const } },
            ],
        }
        : {};

    return await prisma.product.findMany({
        where,
        orderBy: { createdAt: 'desc' }
    });
}

export async function getProjectById(id: number) {
    try {
        const project = await prisma.product.findUnique({
            where: { id },
        });
        return project;
    } catch (error) {
        console.error('Error fetching project:', error);
        return null;
    }
}
