'use client';

import { GalleryForm } from '@/components/gallery/gallery-form';
import { getGalleryImageById } from '@/app/actions/gallery';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function EditGalleryPage() {
    const params = useParams();
    const id = Number(params.id);
    const [image, setImage] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (id) {
            getGalleryImageById(id).then((data) => {
                setImage(data);
                setLoading(false);
            });
        }
    }, [id]);

    if (loading) return <div className="p-8 text-center">Carregando...</div>;

    if (!image) return <div className="p-8 text-center">Imagem não encontrada.</div>;

    return (
        <div className="p-4 md:p-8 max-w-4xl mx-auto">
            <Link href="/gallery" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6">
                <ArrowLeft size={16} /> Voltar
            </Link>

            <h1 className="text-2xl md:text-3xl font-bold mb-8">Editar Imagem</h1>

            <GalleryForm initialData={image} />
        </div>
    );
}
