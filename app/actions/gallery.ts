'use server';

import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import nodeCrypto from 'crypto';

const GallerySchema = z.object({
    title: z.string().min(1, 'Title is required'),
    description: z.string().optional(),
    imageUrl: z.string().url('Invalid URL'),
    publicId: z.string().min(1, 'Public ID is required'),
    tags: z.string().optional(),
});

export async function getGalleryImages(query?: string) {
    try {
        const where = query
            ? {
                OR: [
                    { title: { contains: query, mode: 'insensitive' as const } },
                    { description: { contains: query, mode: 'insensitive' as const } },
                ],
            }
            : {};

        const images = await prisma.gallery.findMany({
            where,
            orderBy: { createdAt: 'desc' },
        });
        return images;
    } catch (error) {
        console.error('Error fetching gallery images:', error);
        return [];
    }
}

export async function createGalleryImage(formData: FormData) {
    try {
        const tagsValue = formData.get('tags');

        const data = {
            title: formData.get('title') as string,
            description: formData.get('description') as string || undefined,
            imageUrl: formData.get('imageUrl') as string,
            publicId: formData.get('publicId') as string,
            tags: tagsValue && tagsValue !== '' ? (tagsValue as string) : undefined,
        };

        const validated = GallerySchema.parse(data);
        const tags = validated.tags ? validated.tags.split(',').map((t) => t.trim()) : [];

        await prisma.gallery.create({
            data: {
                title: validated.title,
                description: validated.description || null,
                imageUrl: validated.imageUrl,
                publicId: validated.publicId,
                tags,
            },
        });

        return { success: true };
    } catch (error) {
        console.error('Error creating gallery image:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Failed to create gallery image' };
    }
}

export async function getGalleryImageById(id: number) {
    try {
        const image = await prisma.gallery.findUnique({
            where: { id },
        });
        return image;
    } catch (error) {
        console.error('Error fetching gallery image:', error);
        return null;
    }
}

export async function updateGalleryImage(id: number, formData: FormData) {
    try {
        const tagsValue = formData.get('tags');

        const data = {
            title: formData.get('title') as string,
            description: formData.get('description') as string || undefined,
            imageUrl: formData.get('imageUrl') as string,
            publicId: formData.get('publicId') as string,
            tags: tagsValue && tagsValue !== '' ? (tagsValue as string) : undefined,
        };

        const validated = GallerySchema.parse(data);
        const tags = validated.tags ? validated.tags.split(',').map((t) => t.trim()) : [];

        await prisma.gallery.update({
            where: { id },
            data: {
                title: validated.title,
                description: validated.description || null,
                imageUrl: validated.imageUrl,
                publicId: validated.publicId,
                tags,
            },
        });

        return { success: true };
    } catch (error) {
        console.error('Error updating gallery image:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Failed to update gallery image' };
    }
}

export async function deleteGalleryImage(id: number) {
    try {
        const image = await prisma.gallery.findUnique({ where: { id } });

        if (!image) {
            return { success: false, error: 'Image not found' };
        }

        // Delete from Cloudinary
        try {
            const timestamp = Math.floor(Date.now() / 1000);
            const apiSecret = process.env.CLOUDINARY_API_SECRET;

            if (apiSecret) {
                const paramsToSign = `public_id=${image.publicId}&timestamp=${timestamp}${apiSecret}`;
                const signature = nodeCrypto.createHash('sha1').update(paramsToSign).digest('hex');

                const response = await fetch(
                    `https://api.cloudinary.com/v1_1/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/destroy`,
                    {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            public_id: image.publicId,
                            api_key: process.env.CLOUDINARY_API_KEY,
                            timestamp: timestamp,
                            signature: signature,
                        }),
                    }
                );

                if (!response.ok) {
                    console.error('Cloudinary deletion failed:', await response.text());
                }
            } else {
                console.warn('CLOUDINARY_API_SECRET not found, skipping Cloudinary deletion');
            }
        } catch (cloudinaryError) {
            console.error('Error deleting from Cloudinary:', cloudinaryError);
            // Continue with database deletion even if Cloudinary fails
        }

        // Delete from database
        await prisma.gallery.delete({ where: { id } });

        return { success: true };
    } catch (error) {
        console.error('Error deleting gallery image:', error);
        return { success: false, error: 'Failed to delete gallery image' };
    }
}
