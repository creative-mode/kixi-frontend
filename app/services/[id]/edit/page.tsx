'use client';

import { ServiceForm } from '@/components/services/service-form';
import { getServiceById } from '@/app/actions/services';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function EditServicePage() {
    const params = useParams();
    const id = Number(params.id);
    const [service, setService] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (id) {
            getServiceById(id).then((data) => {
                setService(data);
                setLoading(false);
            });
        }
    }, [id]);

    if (loading) return <div className="p-8 text-center">Carregando...</div>;

    if (!service) return <div className="p-8 text-center">Serviço não encontrado.</div>;

    return (
        <div className="p-4 md:p-8 max-w-4xl mx-auto">
            <Link href="/services" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6">
                <ArrowLeft size={16} /> Voltar
            </Link>

            <h1 className="text-2xl md:text-3xl font-bold mb-8">Editar Serviço</h1>

            <ServiceForm initialData={service} />
        </div>
    );
}
