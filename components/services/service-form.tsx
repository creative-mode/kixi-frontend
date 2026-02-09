'use client';

import { FormBuilder, useInlineReaction } from '@techify/ui';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { createService, updateService } from '@/app/actions/services';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { FormField } from '@techify/ui';
import { getCurrentUser } from '@/lib/auth';
import { toast } from 'sonner';

const ServiceSchema = z.object({
    num: z.string().min(1, 'Número é obrigatório'),
    title: z.string().min(1, 'Título é obrigatório'),
    description: z.string().min(1, 'Descrição é obrigatória'),
    tags: z.string().min(1, 'Tags são obrigatórias'),
});

type ServiceFormData = z.infer<typeof ServiceSchema>;

interface ServiceFormProps {
    initialData?: {
        id: number;
        num: string;
        title: string;
        description: string;
        tags: string[];
    };
}

export function ServiceForm({ initialData }: ServiceFormProps) {
    const router = useRouter();
    const { status, setLoading, setSuccess, setError, reset } = useInlineReaction();
    const [isReady, setIsReady] = useState(false);

    const form = useForm<ServiceFormData>({
        resolver: zodResolver(ServiceSchema),
        mode: 'onChange',
        defaultValues: {
            num: initialData?.num || '',
            title: initialData?.title || '',
            description: initialData?.description || '',
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

    const fields: FormField<ServiceFormData>[] = [
        {
            name: 'num',
            type: 'text',
            label: 'Número',
            placeholder: '01',
            required: true,
            successMessage: 'Número válido ✓',
        },
        {
            name: 'title',
            type: 'text',
            label: 'Título',
            placeholder: 'Nome do serviço',
            required: true,
            successMessage: 'Título válido ✓',
        },
        {
            name: 'description',
            type: 'textarea',
            label: 'Descrição',
            placeholder: 'Descrição do serviço',
            required: true,
            rows: 4,
            successMessage: 'Descrição válida ✓',
            colSpan: 'full',
        },
        {
            name: 'tags',
            type: 'text',
            label: 'Tags (separadas por vírgula)',
            placeholder: 'React, Node.js, TypeScript',
            required: true,
            successMessage: 'Tags válidas ✓',
            colSpan: 'full',
        },
    ];

    const onSubmit = async (data: ServiceFormData) => {
        setLoading();

        const formData = new FormData();
        formData.append('num', data.num);
        formData.append('title', data.title);
        formData.append('description', data.description);
        formData.append('tags', data.tags);

        let result;
        if (initialData) {
            result = await updateService(initialData.id, formData);
        } else {
            result = await createService(formData);
        }

        if (result.success) {
            setSuccess();
            toast.success(initialData ? 'Serviço atualizado!' : 'Serviço adicionado!');
            setTimeout(() => {
                router.push('/services');
            }, 1000);
        } else {
            setError();
            toast.error(result.error || 'Erro ao salvar serviço.');
        }
    };

    if (!isReady) {
        return <div className="p-8 text-center">Verificando permissões...</div>;
    }

    return (
        <div className="bg-card border rounded-xl p-6">
            <FormBuilder
                form={form}
                fields={fields}
                onSubmit={onSubmit}
                status={status}
                onReset={reset}
                columns={2}
                gap="md"
                submitText={initialData ? 'Atualizar Serviço' : 'Adicionar Serviço'}
                loadingText={initialData ? 'Atualizando...' : 'Adicionando...'}
                successMessage={initialData ? 'Serviço atualizado!' : 'Serviço adicionado!'}
                errorMessage="Erro ao salvar."
                validationMode="inline-reaction"
                validateDebounce={300}
                inputBorderRadius="md"
            />
        </div>
    );
}
