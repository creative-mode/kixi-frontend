'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { createService } from '@/app/actions/services';
import { toast } from 'sonner';

const ServiceSchema = z.object({
    num: z.string().min(1, 'Number is required'),
    title: z.string().min(1, 'Title is required'),
    description: z.string().min(1, 'Description is required'),
    tags: z.string().min(1, 'Tags are required'),
});

export type ServiceFormData = z.infer<typeof ServiceSchema>;

export function useServiceForm(onSuccess?: () => void) {
    const form = useForm<ServiceFormData>({
        resolver: zodResolver(ServiceSchema),
        defaultValues: {
            num: '',
            title: '',
            description: '',
            tags: '',
        },
    });

    const onSubmit = async (data: ServiceFormData) => {
        const formData = new FormData();
        formData.append('num', data.num);
        formData.append('title', data.title);
        formData.append('description', data.description);
        formData.append('tags', data.tags);

        const result = await createService(formData);

        if (result.success) {
            toast.success('Service created successfully');
            form.reset();
            onSuccess?.();
        } else {
            toast.error(result.error || 'Failed to create service');
        }
    };

    return { form, onSubmit };
}
