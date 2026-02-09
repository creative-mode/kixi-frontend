'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { createProject } from '@/app/actions/projects';
import { toast } from 'sonner';

const ProjectSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    description: z.string().min(1, 'Description is required'),
    url: z.string().url('Invalid URL'),
    imageUrl: z.string().optional(),
    features: z.string().min(1, 'Features are required'),
    status: z.enum(['em_desenvolvimento', 'ativo', 'descontinuado']),
});

export type ProjectFormData = z.infer<typeof ProjectSchema>;

export function useProjectForm(onSuccess?: () => void) {
    const form = useForm<ProjectFormData>({
        resolver: zodResolver(ProjectSchema),
        defaultValues: {
            name: '',
            description: '',
            url: '',
            imageUrl: '',
            features: '',
            status: 'em_desenvolvimento',
        },
    });

    const onSubmit = async (data: ProjectFormData) => {
        const formData = new FormData();
        formData.append('name', data.name);
        formData.append('description', data.description);
        formData.append('url', data.url);
        if (data.imageUrl) formData.append('imageUrl', data.imageUrl);
        formData.append('features', data.features);
        formData.append('status', data.status);

        const result = await createProject(formData);

        if (result.success) {
            toast.success('Project created successfully');
            form.reset();
            onSuccess?.();
        } else {
            toast.error(result.error || 'Failed to create project');
        }
    };

    return { form, onSubmit };
}
