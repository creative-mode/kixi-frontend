'use client';

import { FormBuilder, useInlineReaction } from '@techify/ui';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { FormField } from '@techify/ui';
import { toast } from 'sonner';

import { createPartner, updatePartner } from '@/app/actions/partners';
import { getCurrentUser } from '@/lib/auth';
import { GalleryUpload } from '@/components/gallery-upload';

const PartnerSchema = z.object({
    name: z.string().min(1, 'Nome é obrigatório'),
    logoUrl: z.string().url('URL inválida'),
    siteUrl: z.string().url('URL do site inválida'),
});

type PartnerFormData = z.infer<typeof PartnerSchema>;

interface PartnerFormProps {
    initialData?: {
        id: number;
        name: string;
        logoUrl: string;
        siteUrl: string;
    };
}

export function PartnerForm({ initialData }: PartnerFormProps) {
    const router = useRouter();
    const { status, setLoading, setSuccess, setError, reset } = useInlineReaction();
    const [isReady, setIsReady] = useState(false);

    const form = useForm<PartnerFormData>({
        resolver: zodResolver(PartnerSchema),
        mode: 'onChange',
        defaultValues: {
            name: initialData?.name || '',
            logoUrl: initialData?.logoUrl || '',
            siteUrl: initialData?.siteUrl || '',
        },
    });

    useEffect(() => {
        const checkAuth = async () => {
            const user = await getCurrentUser();
            if (!user) {
                toast.error('Você precisa estar logado.');
                router.push('/login');
                return;
            }
            setIsReady(true);
        };
        checkAuth();
    }, [router]);

    const fields: FormField<PartnerFormData>[] = [
        {
            name: 'name',
            type: 'text',
            label: 'Nome do Parceiro',
            placeholder: 'Ex: Google',
            required: true,
            colSpan: 'full',
        },
        {
            name: 'siteUrl',
            type: 'text',
            label: 'Website',
            placeholder: 'https://site.com',
            required: true,
            colSpan: 'full',
        },
        {
            name: 'logoUrl',
            type: 'hidden',
        },
    ];

    const onSubmit = async (data: PartnerFormData) => {
        setLoading();

        const formData = new FormData();
        formData.append('name', data.name);
        formData.append('logoUrl', data.logoUrl);
        formData.append('siteUrl', data.siteUrl);

        const result = initialData
            ? await updatePartner(initialData.id, formData)
            : await createPartner(formData);

        if (result.success) {
            setSuccess();
            toast.success(
                initialData ? 'Parceiro atualizado!' : 'Parceiro criado!'
            );
            setTimeout(() => router.push('/partners'), 1000);
        } else {
            setError();
            toast.error(result.error || 'Erro ao salvar parceiro.');
        }
    };

    if (!isReady) {
        return <div className="p-8 text-center">Verificando permissões...</div>;
    }

    return (
        <div className="bg-card border rounded-xl p-6">
            <div className="mb-6">
                <label className="block text-sm font-medium mb-2">
                    Logo <span className="text-destructive">*</span>
                </label>
                <GalleryUpload
                    currentImage={form.watch('logoUrl')}
                    onUploadComplete={(data) => {
                        form.setValue('logoUrl', data.url);
                    }}
                    onRemove={() => {
                        form.setValue('logoUrl', '');
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
                submitText={initialData ? 'Atualizar Parceiro' : 'Criar Parceiro'}
                loadingText="Salvando..."
                validationMode="inline-reaction"
            />
        </div>
    );
}
