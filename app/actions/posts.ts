'use server';

import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const PostSchema = z.object({
    title: z.string().min(1, 'Title is required'),
    content: z.string().min(1, 'Content is required'),
    authorId: z.string().min(1, 'Author ID is required'),
    authorName: z.string().optional(),
    coverUrl: z.string().optional(),
    tags: z.string().min(1, 'Tags are required'),
});

export async function getPosts(query?: string) {
    try {
        const where = query
            ? {
                OR: [
                    { title: { contains: query, mode: 'insensitive' as const } },
                    { content: { contains: query, mode: 'insensitive' as const } },
                ],
            }
            : {};

        const posts = await prisma.post.findMany({
            where,
            include: {
                _count: {
                    select: {
                        views: true,
                        comments: true,
                        likes: true,
                    },
                },
            },
            orderBy: { publishedAt: 'desc' },
        });
        return posts;
    } catch (error) {
        console.error('Error fetching posts:', error);
        return [];
    }
}

export async function getPostById(id: number) {
    try {
        const post = await prisma.post.findUnique({
            where: { id },
            include: {
                _count: {
                    select: {
                        views: true,
                        comments: true,
                        likes: true,
                    },
                },
            },
        });
        return post;
    } catch (error) {
        console.error('Error fetching post:', error);
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

export async function createPost(formData: FormData) {
    try {
        console.log('=== CREATE POST ACTION STARTED ===');
        const coverUrlValue = formData.get('coverUrl');

        const data = {
            title: formData.get('title') as string,
            content: formData.get('content') as string,
            authorId: formData.get('authorId') as string,
            authorName: formData.get('authorName') as string,
            coverUrl: coverUrlValue && coverUrlValue !== '' ? (coverUrlValue as string) : undefined,
            tags: formData.get('tags') as string,
        };

        console.log('Raw form data:', data);

        const validated = PostSchema.parse(data);
        console.log('Validated data:', validated);

        const tags = validated.tags.split(',').map((t) => t.trim());

        let slug = generateSlug(validated.title);

        // Ensure slug uniqueness
        let count = 1;
        while (await prisma.post.findUnique({ where: { slug } })) {
            slug = `${generateSlug(validated.title)}-${count}`;
            count++;
        }

        console.log('Generated slug:', slug);
        console.log('Creating post with data:', {
            title: validated.title,
            slug,
            authorId: validated.authorId,
            authorName: validated.authorName,
            tags,
        });

        await prisma.post.create({
            data: {
                title: validated.title,
                slug,
                content: validated.content,
                authorId: validated.authorId,
                authorName: validated.authorName,
                coverUrl: validated.coverUrl || null,
                tags,
            },
        });

        console.log('=== POST CREATED SUCCESSFULLY ===');
        return { success: true };
    } catch (error) {
        console.error('=== ERROR CREATING POST ===');
        console.error('Error details:', error);
        if (error instanceof Error) {
            console.error('Error message:', error.message);
            console.error('Error stack:', error.stack);
        }
        return { success: false, error: error instanceof Error ? error.message : 'Failed to create post' };
    }
}

export async function updatePost(id: number, formData: FormData) {
    try {
        const coverUrlValue = formData.get('coverUrl');

        const data = {
            title: formData.get('title') as string,
            content: formData.get('content') as string,
            authorId: formData.get('authorId') as string,
            coverUrl: coverUrlValue && coverUrlValue !== '' ? (coverUrlValue as string) : undefined,
            tags: formData.get('tags') as string,
        };

        const validated = PostSchema.parse(data);
        const tags = validated.tags.split(',').map((t) => t.trim());

        await prisma.post.update({
            where: { id },
            data: {
                title: validated.title,
                content: validated.content,
                coverUrl: validated.coverUrl || null,
                tags,
            },
        });

        return { success: true };
    } catch (error) {
        console.error('Error updating post:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Failed to update post' };
    }
}

export async function deletePost(id: number) {
    try {
        await prisma.post.delete({ where: { id } });
        return { success: true };
    } catch (error) {
        console.error('Error deleting post:', error);
        return { success: false, error: 'Failed to delete post' };
    }
}

export async function getComments(approved?: boolean) {
    try {
        const comments = await prisma.comment.findMany({
            where: approved !== undefined ? { approved } : undefined,
            include: {
                post: {
                    select: {
                        id: true,
                        title: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
        return comments;
    } catch (error) {
        console.error('Error fetching comments:', error);
        return [];
    }
}

export async function approveComment(id: number) {
    try {
        await prisma.comment.update({
            where: { id },
            data: { approved: true },
        });
        return { success: true };
    } catch (error) {
        console.error('Error approving comment:', error);
        return { success: false, error: 'Failed to approve comment' };
    }
}

export async function deleteComment(id: number) {
    try {
        await prisma.comment.delete({ where: { id } });
        return { success: true };
    } catch (error) {
        console.error('Error deleting comment:', error);
        return { success: false, error: 'Failed to delete comment' };
    }
}
