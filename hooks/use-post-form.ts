'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { createPost } from '@/app/actions/posts';
import { toast } from 'sonner';

const PostSchema = z.object({
    title: z.string().min(1, 'Title is required'),
    content: z.string().min(1, 'Content is required'),
    authorId: z.string().min(1, 'Author ID is required'),
    coverUrl: z.string().optional(),
    tags: z.string().min(1, 'Tags are required'),
});

export type PostFormData = z.infer<typeof PostSchema>;

export function usePostForm(onSuccess?: () => void) {
    const form = useForm<PostFormData>({
        resolver: zodResolver(PostSchema),
        defaultValues: {
            title: '',
            content: '',
            authorId: 'admin',
            coverUrl: '',
            tags: '',
        },
    });

    const onSubmit = async (data: PostFormData) => {
        const formData = new FormData();
        formData.append('title', data.title);
        formData.append('content', data.content);
        formData.append('authorId', data.authorId);
        if (data.coverUrl) formData.append('coverUrl', data.coverUrl);
        formData.append('tags', data.tags);

        const result = await createPost(formData);

        if (result.success) {
            toast.success('Post created successfully');
            form.reset();
            onSuccess?.();
        } else {
            toast.error(result.error || 'Failed to create post');
        }
    };

    return { form, onSubmit };
}
