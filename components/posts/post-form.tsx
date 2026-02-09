'use client';

import { FormBuilder, useInlineReaction } from '@techify/ui';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { createPost, updatePost } from '@/app/actions/posts';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { FormField } from '@techify/ui';
import { getCurrentUser } from '@/lib/auth';
import { ImageUpload } from '@/components/image-upload';
import { toast } from 'sonner';

const PostSchema = z.object({
    title: z.string().min(1, 'Título é obrigatório'),
    content: z.string().min(10, 'Conteúdo muito curto (mínimo 10 caracteres)'),
    authorId: z.string().min(1, 'ID do autor é obrigatório'),
    authorName: z.string().optional(),
    coverUrl: z.string().url('URL inválida').optional().or(z.literal('')),
    tags: z.string().min(1, 'Tags são obrigatórias'),
    scheduledAt: z.string().optional().nullable(),
});

type PostFormData = z.infer<typeof PostSchema>;

interface PostFormProps {
    initialData?: {
        id: number;
        title: string;
        content: string;
        authorId: string;
        authorName?: string | null;
        coverUrl?: string | null;
        tags: string[];
        scheduledAt?: string | Date | null;
    };
}

export function PostForm({ initialData }: PostFormProps) {
    const router = useRouter();
    const { status, setLoading, setSuccess, setError, reset } = useInlineReaction();
    const [isReady, setIsReady] = useState(false);

    const form = useForm<PostFormData>({
        resolver: zodResolver(PostSchema),
        mode: 'onChange',
        defaultValues: {
            title: initialData?.title || '',
            content: initialData?.content || '',
            authorId: initialData?.authorId || '',
            authorName: initialData?.authorName || '',
            coverUrl: initialData?.coverUrl || '',
            tags: initialData?.tags.join(', ') || '',
            scheduledAt: initialData?.scheduledAt ? new Date(initialData.scheduledAt).toISOString() : '',
        },
    });

    useEffect(() => {
        const checkAuth = async () => {
            try {
                const user = await getCurrentUser();
                if (user) {
                    if (!initialData) {
                        form.setValue('authorId', String(user.id));
                        form.setValue('authorName', user.name || '');
                    }
                    setIsReady(true);
                } else {
                    toast.error('Você precisa estar logado para realizar esta ação.');
                    router.push('/login');
                }
            } catch (error) {
                console.error('Auth check failed', error);
                toast.error('Erro ao verificar autenticação.');
            }
        };
        checkAuth();
    }, [initialData, form, router]);

    const fields: FormField<PostFormData>[] = [
        {
            name: 'title',
            type: 'text',
            label: 'Título',
            placeholder: 'Título do post',
            required: true,
            successMessage: 'Título válido ✓',
            colSpan: 'full',
        },
        {
            name: 'content',
            type: 'textarea',
            label: 'Conteúdo',
            placeholder: 'Escreva o conteúdo do post...',
            required: true,
            rows: 12,
            successMessage: 'Conteúdo válido ✓',
            colSpan: 'full',
        },
        {
            name: 'tags',
            type: 'text',
            label: 'Tags (separadas por vírgula)',
            placeholder: 'tecnologia, web, design',
            required: true,
            successMessage: 'Tags válidas ✓',
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
        {
            name: 'authorId',
            type: 'hidden',
        },
        {
            name: 'authorName',
            type: 'hidden',
        },
    ];

    const onSubmit = async (data: PostFormData) => {
        setLoading();

        const formData = new FormData();
        formData.append('title', data.title);
        formData.append('content', data.content);
        formData.append('authorId', data.authorId);
        if (data.authorName) formData.append('authorName', data.authorName);
        if (data.coverUrl) formData.append('coverUrl', data.coverUrl);
        formData.append('tags', data.tags);
        if (data.scheduledAt) formData.append('scheduledAt', data.scheduledAt);

        let result;
        if (initialData) {
            result = await updatePost(initialData.id, formData);
        } else {
            result = await createPost(formData);
        }

        if (result.success) {
            setSuccess();
            toast.success(initialData ? 'Post atualizado com sucesso!' : 'Post criado com sucesso!');
            setTimeout(() => {
                router.push('/posts');
            }, 1000);
        } else {
            setError();
            toast.error(result.error || 'Erro ao salvar post.');
        }
    };

    if (!isReady) {
        return <div className="p-8 text-center">Verificando permissões...</div>;
    }

    return (
        <div className="bg-card border rounded-xl p-6">
            <div className="mb-6">
                <label className="block text-sm font-medium mb-2">
                    Imagem de Capa (Opcional)
                </label>
                <ImageUpload
                    currentImage={form.watch('coverUrl')}
                    onUploadComplete={(url) => form.setValue('coverUrl', url)}
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
                submitText={initialData ? 'Atualizar Post' : 'Publicar Post'}
                loadingText={initialData ? 'Atualizando...' : 'Publicando...'}
                successMessage={initialData ? 'Post atualizado!' : 'Post publicado!'}
                errorMessage="Erro ao salvar."
                validationMode="inline-reaction"
                validateDebounce={300}
                inputBorderRadius="md"
            />
        </div>
    );
}
