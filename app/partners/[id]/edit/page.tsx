'use client';

import { PartnerForm } from '@/components/partners/partner-form';
import { getPartnerById } from '@/app/actions/partners';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function EditPartnerPage() {
    const params = useParams();
    const id = Number(params.id);

    const [partner, setPartner] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (id) {
            getPartnerById(id).then((data) => {
                setPartner(data);
                setLoading(false);
            });
        }
    }, [id]);

    if (loading) {
        return <div className="p-8 text-center">Carregando...</div>;
    }

    if (!partner) {
        return <div className="p-8 text-center">Parceiro não encontrado.</div>;
    }

    return (
        <div className="p-4 md:p-8 max-w-4xl mx-auto">
            <Link
                href="/partners"
                className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6"
            >
                <ArrowLeft size={16} /> Voltar
            </Link>

            <h1 className="text-2xl md:text-3xl font-bold mb-8">
                Editar Parceiro
            </h1>

            <PartnerForm initialData={partner} />
        </div>
    );
}
