'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import { useInlineReaction, FormBuilder } from '@techify/ui';
import { toast } from 'sonner';
import { createCareer, updateCareerStatus } from '@/app/actions/careers';

const CareerSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  email: z.string().email('Email inválido'),
  phone: z.string().min(1, 'Telefone é obrigatório'),
  position: z.string().min(1, 'Cargo é obrigatório'),
  portfolio: z.string().optional(),
  experience: z.string().min(1, 'Experiência é obrigatória'),
  motivation: z.string().min(1, 'Motivação é obrigatória'),
});

type CareerFormData = z.infer<typeof CareerSchema>;

interface CareerFormProps {
  initialData?: CareerFormData & { status?: string; id?: number };
}

export function CareerForm({ initialData }: CareerFormProps) {
  const router = useRouter();
  const { status, setLoading, setSuccess, setError, reset } = useInlineReaction();

  const form = useForm<CareerFormData>({
    resolver: zodResolver(CareerSchema),
    mode: 'onChange',
    defaultValues: {
      name: initialData?.name || '',
      email: initialData?.email || '',
      phone: initialData?.phone || '',
      position: initialData?.position || '',
      portfolio: initialData?.portfolio || '',
      experience: initialData?.experience || '',
      motivation: initialData?.motivation || '',
    },
  });

  const fields: import('@techify/ui').FormField<CareerFormData>[] = [
    { name: 'name', type: 'text', label: 'Nome', placeholder: 'Seu nome', required: true, colSpan: 'full' },
    { name: 'email', type: 'text', label: 'Email', placeholder: 'Seu email', required: true, colSpan: 'full' },
    { name: 'phone', type: 'text', label: 'Telefone', placeholder: 'Telefone', required: true, colSpan: 'full' },
    { name: 'position', type: 'text', label: 'Cargo pretendido', placeholder: 'Cargo desejado', required: true, colSpan: 'full' },
    { name: 'portfolio', type: 'text', label: 'Portfólio (opcional)', placeholder: 'Link para portfólio', colSpan: 'full' },
    { name: 'experience', type: 'textarea', label: 'Experiência', placeholder: 'Descreva sua experiência', rows: 3, colSpan: 'full' },
    { name: 'motivation', type: 'textarea', label: 'Motivação', placeholder: 'Por que deseja a vaga?', rows: 3, colSpan: 'full' },
  ];

  const onSubmit = async (data: CareerFormData) => {
    setLoading();

    const formData = new FormData();
    for (const key in data) {
      const value = data[key as keyof CareerFormData];
      formData.append(key, value !== undefined ? value : '');
    }

    // Captura IP e User Agent
    formData.append('ipAddress', ''); // pode preencher via server-side
    formData.append('userAgent', navigator.userAgent);

    let result;
    if (initialData?.id) {
      // Atualização: status opcional
      result = await updateCareerStatus(initialData.id, initialData.status || 'Pendente');
    } else {
      result = await createCareer(formData);
    }

    if (result.success) {
      setSuccess();
      toast.success(initialData ? 'Submissão atualizada!' : 'Submissão registrada!');
      setTimeout(() => router.push('/careers'), 1000);
    } else {
      setError();
      toast.error(result.error || 'Erro ao salvar submissão.');
    }
  };

  return (
    <div className="bg-card border rounded-xl p-6">
      <FormBuilder
        form={form}
        fields={fields}
        onSubmit={onSubmit}
        status={status}
        onReset={reset}
        columns={1}
        gap="md"
        submitText={initialData ? 'Atualizar Submissão' : 'Enviar Candidatura'}
        loadingText={initialData ? 'Atualizando...' : 'Enviando...'}
        successMessage={initialData ? 'Submissão atualizada!' : 'Submissão registrada!'}
        errorMessage="Erro ao salvar."
        validationMode="inline-reaction"
        validateDebounce={300}
        inputBorderRadius="md"
      />
    </div>
  );
}
