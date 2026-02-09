'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { TestimonialForm } from '@/components/testimonials/testimonial-form';
import { getTestimonialById } from '@/app/actions/testimonials';

export default function EditTestimonialPage() {
    const { id } = useParams();
    const [data, setData] = useState<any>(null);

    useEffect(() => {
        getTestimonialById(Number(id)).then(setData);
    }, [id]);

    if (!data) return <div className="p-8 text-center">Carregando…</div>;

    return (
        <div className="max-w-4xl mx-auto p-8">
            <h1 className="text-3xl font-bold mb-8">Editar Testemunho</h1>
            <TestimonialForm initialData={data} />
        </div>
    );
}
