'use client';

import { FormBuilder, useInlineReaction } from '@techify/ui';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { createProject, updateProject } from '@/app/actions/projects';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { FormField } from '@techify/ui';
import { getCurrentUser } from '@/lib/auth';
import { toast } from 'sonner';

const ProjectSchema = z.object({
    name: z.string().min(1, 'Nome é obrigatório'),
    description: z.string().min(1, 'Descrição é obrigatória'),
    url: z.string().url('URL inválida'),
    imageUrl: z.string().url('URL inválida').optional().or(z.literal('')),
    features: z.string().min(1, 'Features são obrigatórias'),
    status: z.enum(['em_desenvolvimento', 'ativo', 'descontinuado']),
});

type ProjectFormData = z.infer<typeof ProjectSchema>;

interface ProjectFormProps {
    initialData?: {
        id: number;
        name: string;
        description: string;
        url: string;
        imageUrl?: string | null;
        features: string[];
        status: string;
    };
}

export function ProjectForm({ initialData }: ProjectFormProps) {
    const router = useRouter();
    const { status, setLoading, setSuccess, setError, reset } = useInlineReaction();
    const [isReady, setIsReady] = useState(false);

    const form = useForm<ProjectFormData>({
        resolver: zodResolver(ProjectSchema),
        mode: 'onChange',
        defaultValues: {
            name: initialData?.name || '',
            description: initialData?.description || '',
            url: initialData?.url || '',
            imageUrl: initialData?.imageUrl || '',
            features: initialData?.features.join(', ') || '',
            status: (initialData?.status as any) || 'em_desenvolvimento',
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

    const fields: FormField<ProjectFormData>[] = [
        {
            name: 'name',
            type: 'text',
            label: 'Nome do Projeto',
            placeholder: 'Nome do projeto',
            required: true,
            successMessage: 'Nome válido ✓',
        },
        {
            name: 'status',
            type: 'select',
            label: 'Status',
            required: true,
            options: [
                { value: 'em_desenvolvimento', label: 'Em Desenvolvimento' },
                { value: 'ativo', label: 'Ativo' },
                { value: 'descontinuado', label: 'Descontinuado' },
            ],
        },
        {
            name: 'description',
            type: 'textarea',
            label: 'Descrição',
            placeholder: 'Descrição do projeto',
            required: true,
            rows: 4,
            successMessage: 'Descrição válida ✓',
            colSpan: 'full',
        },
        {
            name: 'url',
            type: 'url',
            label: 'URL do Projeto',
            placeholder: 'https://...',
            required: true,
            successMessage: 'URL válida ✓',
        },
        {
            name: 'imageUrl',
            type: 'url',
            label: 'URL da Imagem',
            placeholder: 'https://...',
            successMessage: 'URL válida ✓',
        },
        {
            name: 'features',
            type: 'text',
            label: 'Features (separadas por vírgula)',
            placeholder: 'Feature 1, Feature 2, Feature 3',
            required: true,
            successMessage: 'Features válidas ✓',
            colSpan: 'full',
        },
    ];

    const onSubmit = async (data: ProjectFormData) => {
        setLoading();

        const formData = new FormData();
        formData.append('name', data.name);
        formData.append('description', data.description);
        formData.append('url', data.url);
        if (data.imageUrl) formData.append('imageUrl', data.imageUrl);
        formData.append('features', data.features);
        formData.append('status', data.status);

        let result;
        if (initialData) {
            result = await updateProject(initialData.id, formData);
        } else {
            result = await createProject(formData);
        }

        if (result.success) {
            setSuccess();
            toast.success(initialData ? 'Projeto atualizado!' : 'Projeto adicionado!');
            setTimeout(() => {
                router.push('/projects');
            }, 1000);
        } else {
            setError();
            toast.error(result.error || 'Erro ao salvar projeto.');
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
                submitText={initialData ? 'Atualizar Projeto' : 'Adicionar Projeto'}
                loadingText={initialData ? 'Atualizando...' : 'Adicionando...'}
                successMessage={initialData ? 'Projeto atualizado!' : 'Projeto adicionado!'}
                errorMessage="Erro ao salvar."
                validationMode="inline-reaction"
                validateDebounce={300}
                inputBorderRadius="md"
            />
        </div>
    );
}
