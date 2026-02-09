'use server';

import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const CareerSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  email: z.string().email('Email inválido'),
  phone: z.string().min(1, 'Telefone é obrigatório'),
  position: z.string().min(1, 'Cargo é obrigatório'),
  portfolio: z.string().optional(),
  experience: z.string().min(1, 'Experiência é obrigatória'),
  motivation: z.string().min(1, 'Motivação é obrigatória'),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
  status: z.string().optional(),
});

export async function getCareers(query?: string) {
  try {
    const where = query
      ? {
          OR: [
            { name: { contains: query, mode: 'insensitive' as const } },
            { email: { contains: query, mode: 'insensitive' as const } },
            { position: { contains: query, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const careers = await prisma.career.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return careers;
  } catch (error) {
    console.error('Error fetching careers:', error);
    return [];
  }
}

export async function getCareerById(id: number) {
  try {
    const career = await prisma.career.findUnique({
      where: { id },
    });
    return career;
  } catch (error) {
    console.error('Error fetching career:', error);
    return null;
  }
}

export async function createCareer(formData: FormData) {
  try {
    const data = {
      name: formData.get('name') as string,
      email: formData.get('email') as string,
      phone: formData.get('phone') as string,
      position: formData.get('position') as string,
      portfolio: (formData.get('portfolio') as string) || '',
      experience: formData.get('experience') as string,
      motivation: formData.get('motivation') as string,
      ipAddress: (formData.get('ipAddress') as string) || '',
      userAgent: (formData.get('userAgent') as string) || '',
      status: 'Pendente',
    };

    const validated = CareerSchema.parse(data);

    const prismaData = {
      ...validated,
      portfolio: validated.portfolio ?? '',
      ipAddress: validated.ipAddress ?? '',
      userAgent: validated.userAgent ?? '',
      status: validated.status ?? 'Pendente',
    };

    await prisma.career.create({ data: prismaData });

    return { success: true };
  } catch (error) {
    console.error('Error creating career:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create career submission',
    };
  }
}

export async function updateCareerStatus(id: number, status: string) {
  try {
    await prisma.career.update({
      where: { id },
      data: { status },
    });

    return { success: true };
  } catch (error) {
    console.error('Error updating career status:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Failed to update career' };
  }
}

export async function deleteCareer(id: number) {
  try {
    const career = await prisma.career.findUnique({ where: { id } });

    if (!career) {
      return { success: false, error: 'Submissão não encontrada' };
    }

    await prisma.career.delete({ where: { id } });

    return { success: true };
  } catch (error) {
    console.error('Error deleting career:', error);
    return { success: false, error: 'Failed to delete career' };
  }
}
