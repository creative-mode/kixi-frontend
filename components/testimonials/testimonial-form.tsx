'use client';

import { FormBuilder, useInlineReaction } from '@techify/ui';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import type { FormField } from '@techify/ui';

import { GalleryUpload } from '@/components/gallery-upload';
import { getCurrentUser } from '@/lib/auth';
import { createTestimonial, updateTestimonial } from '@/app/actions/testimonials';

const TestimonialSchema = z.object({
    name: z.string().min(1, 'Nome é obrigatório'),
    position: z.string().min(1, 'Cargo é obrigatório'),
    headline: z.string().min(1, 'Título é obrigatório'),
    content: z.string().min(1, 'Depoimento é obrigatório'),
    imageUrl: z.string().url('URL inválida'),
    publicId: z.string().optional(),
});

type TestimonialFormData = z.infer<typeof TestimonialSchema>;

interface TestimonialFormProps {
    initialData?: {
        id: number;
        name: string;
        position: string;
        headline: string;
        content: string;
        imageUrl: string;
        publicId: string;
    };
}

export function TestimonialForm({ initialData }: TestimonialFormProps) {
    const router = useRouter();
    const { status, setLoading, setSuccess, setError, reset } = useInlineReaction();
    const [isReady, setIsReady] = useState(false);

    const form = useForm<TestimonialFormData>({
        resolver: zodResolver(TestimonialSchema),
        mode: 'onChange',
        defaultValues: initialData ?? {
            name: '',
            position: '',
            headline: '',
            content: '',
            imageUrl: '',
            publicId: '',
        },
    });

    useEffect(() => {
        const checkAuth = async () => {
            try {
                const user = await getCurrentUser();
                if (!user) {
                    toast.error('Você precisa estar logado para realizar esta ação.');
                    router.push('/login');
                } else {
                    setIsReady(true);
                }
            } catch (error) {
                console.error('Auth check failed', error);
                toast.error('Erro ao verificar autenticação.');
            }
        };
        checkAuth();
    }, [router]);

    const fields: FormField<TestimonialFormData>[] = [
        { name: 'name', type: 'text', label: 'Nome', required: true, successMessage: 'Nome válido ✓', colSpan: 'full' },
        { name: 'position', type: 'text', label: 'Cargo', required: true, successMessage: 'Cargo válido ✓', colSpan: 'full' },
        { name: 'headline', type: 'text', label: 'Título', required: true, successMessage: 'Título válido ✓', colSpan: 'full' },
        { name: 'content', type: 'textarea', label: 'Depoimento', rows: 4, required: true, colSpan: 'full' },
        { name: 'imageUrl', type: 'hidden' },
        { name: 'publicId', type: 'hidden' },
    ];

    const onSubmit = async (data: TestimonialFormData) => {
        setLoading();

        const { publicId, ...dataToSend } = data;
        const formData = new FormData();
        Object.entries(dataToSend).forEach(([key, value]) => {
            formData.append(key, value);
        });

        let result;
        if (initialData) {
            result = await updateTestimonial(initialData.id, formData);
        } else {
            result = await createTestimonial(formData);
        }

        if (result.success) {
            setSuccess();
            toast.success(initialData ? 'Depoimento atualizado!' : 'Depoimento criado!');
            setTimeout(() => router.push('/testimonials'), 1000);
        } else {
            setError();
            toast.error(result.error || 'Erro ao salvar depoimento.');
        }
    };

    if (!isReady) {
        return <div className="p-8 text-center">Verificando permissões...</div>;
    }

    return (
        <div className="bg-card border rounded-xl p-6">
            <div className="mb-6">
                <label className="block text-sm font-medium mb-2">
                    Foto <span className="text-destructive">*</span>
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
                submitText={initialData ? 'Atualizar Depoimento' : 'Criar Depoimento'}
                loadingText={initialData ? 'Atualizando...' : 'Criando...'}
                successMessage={initialData ? 'Depoimento atualizado!' : 'Depoimento criado!'}
                errorMessage="Erro ao salvar."
                validationMode="inline-reaction"
                validateDebounce={300}
                inputBorderRadius="md"
            />
        </div>
    );
}
