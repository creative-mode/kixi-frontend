'use client';

import { FormBuilder, useInlineReaction } from '@techify/ui';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { createGalleryImage, updateGalleryImage } from '@/app/actions/gallery';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { FormField } from '@techify/ui';
import { getCurrentUser } from '@/lib/auth';
import { GalleryUpload } from '@/components/gallery-upload';
import { toast } from 'sonner';

const GallerySchema = z.object({
    title: z.string().min(1, 'Título é obrigatório'),
    description: z.string().optional(),
    imageUrl: z.string().url('URL inválida'),
    publicId: z.string().min(1, 'Public ID é obrigatório'),
    tags: z.string().optional(),
});

type GalleryFormData = z.infer<typeof GallerySchema>;

interface GalleryFormProps {
    initialData?: {
        id: number;
        title: string;
        description?: string | null;
        imageUrl: string;
        publicId: string;
        tags: string[];
    };
}

export function GalleryForm({ initialData }: GalleryFormProps) {
    const router = useRouter();
    const { status, setLoading, setSuccess, setError, reset } = useInlineReaction();
    const [isReady, setIsReady] = useState(false);

    const form = useForm<GalleryFormData>({
        resolver: zodResolver(GallerySchema),
        mode: 'onChange',
        defaultValues: {
            title: initialData?.title || '',
            description: initialData?.description || '',
            imageUrl: initialData?.imageUrl || '',
            publicId: initialData?.publicId || '',
            tags: initialData?.tags.join(', ') || '',
        },
    });

    useEffect(() => {
        const checkAuth = async () => {
            try {
                const user = await getCurrentUser();
                if (user) {
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
    }, [router]);

    const fields: FormField<GalleryFormData>[] = [
        {
            name: 'title',
            type: 'text',
            label: 'Título',
            placeholder: 'Título da imagem',
            required: true,
            successMessage: 'Título válido ✓',
            colSpan: 'full',
        },
        {
            name: 'description',
            type: 'textarea',
            label: 'Descrição (Opcional)',
            placeholder: 'Descrição da imagem...',
            rows: 3,
            colSpan: 'full',
        },
        {
            name: 'tags',
            type: 'text',
            label: 'Tags (separadas por vírgula)',
            placeholder: 'design, web, tecnologia',
            colSpan: 'full',
        },
        {
            name: 'imageUrl',
            type: 'hidden',
        },
        {
            name: 'publicId',
            type: 'hidden',
        },
    ];

    const onSubmit = async (data: GalleryFormData) => {
        setLoading();

        const formData = new FormData();
        formData.append('title', data.title);
        if (data.description) formData.append('description', data.description);
        formData.append('imageUrl', data.imageUrl);
        formData.append('publicId', data.publicId);
        if (data.tags) formData.append('tags', data.tags);

        let result;
        if (initialData) {
            result = await updateGalleryImage(initialData.id, formData);
        } else {
            result = await createGalleryImage(formData);
        }

        if (result.success) {
            setSuccess();
            toast.success(initialData ? 'Imagem atualizada!' : 'Imagem adicionada!');
            setTimeout(() => {
                router.push('/gallery');
            }, 1000);
        } else {
            setError();
            toast.error(result.error || 'Erro ao salvar imagem.');
        }
    };

    if (!isReady) {
        return <div className="p-8 text-center">Verificando permissões...</div>;
    }

    return (
        <div className="bg-card border rounded-xl p-6">
            <div className="mb-6">
                <label className="block text-sm font-medium mb-2">
                    Imagem <span className="text-destructive">*</span>
                </label>
                <GalleryUpload
                    currentImage={form.watch('imageUrl')}
                    onUploadComplete={(data) => {
                        form.setValue('imageUrl', data.url);
                        form.setValue('publicId', data.publicId);
                    }}
                    onRemove={() => {
                        form.setValue('imageUrl', '');
                        form.setValue('publicId', '');
                    }}
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
                submitText={initialData ? 'Atualizar Imagem' : 'Adicionar à Galeria'}
                loadingText={initialData ? 'Atualizando...' : 'Adicionando...'}
                successMessage={initialData ? 'Imagem atualizada!' : 'Imagem adicionada!'}
                errorMessage="Erro ao salvar."
                validationMode="inline-reaction"
                validateDebounce={300}
                inputBorderRadius="md"
            />
        </div>
    );
}
