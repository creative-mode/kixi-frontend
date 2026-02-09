'use server';

import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const PartnerSchema = z.object({
    name: z.string().min(1),
    logoUrl: z.string().url(),
    siteUrl: z.string().url(),
});

export async function getPartners() {
    try {
        return await prisma.partner.findMany({
            orderBy: { createdAt: 'desc' },
        });
    } catch (error) {
        console.error(error);
        return [];
    }
}

export async function getPartnerById(id: number) {
    try {
        return await prisma.partner.findUnique({ where: { id } });
    } catch {
        return null;
    }
}

export async function createPartner(formData: FormData) {
    try {
        const data = {
            name: formData.get('name') as string,
            logoUrl: formData.get('logoUrl') as string,
            siteUrl: formData.get('siteUrl') as string,
        };

        const validated = PartnerSchema.parse(data);

        await prisma.partner.create({ data: validated });

        return { success: true };
    } catch (error) {
        console.error(error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Erro ao criar parceiro',
        };
    }
}

export async function updatePartner(id: number, formData: FormData) {
    try {
        const data = {
            name: formData.get('name') as string,
            logoUrl: formData.get('logoUrl') as string,
            siteUrl: formData.get('siteUrl') as string,
        };

        const validated = PartnerSchema.parse(data);

        await prisma.partner.update({
            where: { id },
            data: validated,
        });

        return { success: true };
    } catch (error) {
        console.error(error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Erro ao atualizar parceiro',
        };
    }
}

export async function deletePartner(id: number) {
    try {
        await prisma.partner.delete({ where: { id } });
        return { success: true };
    } catch {
        return { success: false, error: 'Erro ao remover parceiro' };
    }
}
