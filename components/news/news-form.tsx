'use client';

import { FormBuilder, useInlineReaction } from '@techify/ui';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { createNews, updateNews } from '@/app/actions/news';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { FormField } from '@techify/ui';
import { GalleryUpload } from '@/components/gallery-upload';
import { toast } from 'sonner';
import { format } from 'date-fns';

const NewsSchema = z.object({
    title: z.string().min(1, 'Título é obrigatório'),
    content: z.string().min(1, 'Conteúdo é obrigatório'),
    coverUrl: z.string().optional(),
    scheduledAt: z.string().optional().nullable(),
});

type NewsFormData = z.infer<typeof NewsSchema>;

interface NewsFormProps {
    initialData?: {
        id: number;
        title: string;
        content: string;
        coverUrl?: string | null;
        scheduledAt?: string | Date | null;
    };
}

export function NewsForm({ initialData }: NewsFormProps) {
    const router = useRouter();
    const { status, setLoading, setSuccess, setError, reset } = useInlineReaction();

    const form = useForm<NewsFormData>({
        resolver: zodResolver(NewsSchema),
        mode: 'onChange',
        defaultValues: {
            title: initialData?.title || '',
            content: initialData?.content || '',
            coverUrl: initialData?.coverUrl || '',
            scheduledAt: initialData?.scheduledAt ? format(new Date(initialData.scheduledAt), "yyyy-MM-dd'T'HH:mm") : '',
        },
    });

    const fields: FormField<NewsFormData>[] = [
        {
            name: 'title',
            type: 'text',
            label: 'Título',
            placeholder: 'Título da notícia',
            required: true,
            successMessage: 'Título válido ✓',
            colSpan: 'full',
        },
        {
            name: 'content',
            type: 'textarea',
            label: 'Conteúdo',
            placeholder: 'Conteúdo da notícia...',
            required: true,
            rows: 12,
            successMessage: 'Conteúdo válido ✓',
            colSpan: 'full',
        },
        {
            name: 'scheduledAt',
            type: 'datetime-local',
            label: 'Agendar Publicação (Opcional)',
            placeholder: 'Selecione a data e hora',
            required: false,
            successMessage: 'Data válida ✓',
            colSpan: 'full',
        },
    ];

    const onSubmit = async (data: NewsFormData) => {
        setLoading();

        const formData = new FormData();
        formData.append('title', data.title);
        formData.append('content', data.content);
        if (data.coverUrl) formData.append('coverUrl', data.coverUrl);
        if (data.scheduledAt) formData.append('scheduledAt', data.scheduledAt);

        let result;
        if (initialData) {
            result = await updateNews(initialData.id, formData);
        } else {
            result = await createNews(formData);
        }

        if (result.success) {
            setSuccess();
            toast.success(initialData ? 'Notícia atualizada!' : 'Notícia criada!');
            setTimeout(() => {
                router.push('/news');
            }, 1000);
        } else {
            setError();
            toast.error(result.error || 'Erro ao salvar notícia');
        }
    };

    return (
        <div className="bg-card border rounded-xl p-6">
            <div className="mb-6">
                <label className="block text-sm font-medium mb-2">
                    Imagem de Capa (Opcional)
                </label>
                <GalleryUpload
                    currentImage={form.watch('coverUrl') || ''}
                    onUploadComplete={(data) => form.setValue('coverUrl', data.url)}
                    onRemove={() => form.setValue('coverUrl', '')}
                />
            </div>

            <FormBuilder
                form={form}
                fields={fields}
                onSubmit={onSubmit}
                status={status}
                onReset={reset}
                columns={1}
                gap="md"
                submitText={initialData ? 'Atualizar Notícia' : 'Publicar Notícia'}
                loadingText={initialData ? 'Atualizando...' : 'Publicando...'}
                successMessage={initialData ? 'Notícia atualizada!' : 'Notícia publicada!'}
                errorMessage="Erro ao salvar."
                validationMode="inline-reaction"
                validateDebounce={300}
                inputBorderRadius="md"
            />
        </div>
    );
}
