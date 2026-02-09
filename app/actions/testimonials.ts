'use server';

import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const TestimonialSchema = z.object({
    name: z.string().min(1),
    position: z.string().min(1),
    headline: z.string().min(1),
    content: z.string().min(1),
    imageUrl: z.string().url(),
});

export async function getTestimonials() {
    try {
        return await prisma.testimonial.findMany({
            orderBy: { createdAt: 'desc' },
        });
    } catch {
        return [];
    }
}

export async function getTestimonialById(id: number) {
    try {
        return await prisma.testimonial.findUnique({ where: { id } });
    } catch {
        return null;
    }
}

export async function createTestimonial(formData: FormData) {
    try {
        const data = {
            name: formData.get('name') as string,
            position: formData.get('position') as string,
            headline: formData.get('headline') as string,
            content: formData.get('content') as string,
            imageUrl: formData.get('imageUrl') as string,
        };

        const validated = TestimonialSchema.parse(data);
        await prisma.testimonial.create({ data: validated });

        return { success: true };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Erro ao criar testemunho',
        };
    }
}

export async function updateTestimonial(id: number, formData: FormData) {
    try {
        const data = {
            name: formData.get('name') as string,
            position: formData.get('position') as string,
            headline: formData.get('headline') as string,
            content: formData.get('content') as string,
            imageUrl: formData.get('imageUrl') as string,
        };

        const validated = TestimonialSchema.parse(data);

        await prisma.testimonial.update({
            where: { id },
            data: validated,
        });

        return { success: true };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Erro ao atualizar testemunho',
        };
    }
}

export async function deleteTestimonial(id: number) {
    try {
        await prisma.testimonial.delete({ where: { id } });
        return { success: true };
    } catch {
        return { success: false, error: 'Erro ao remover testemunho' };
    }
}
