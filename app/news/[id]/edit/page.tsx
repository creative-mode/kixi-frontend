'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { NewsForm } from '@/components/news/news-form';
import { getNewsById } from '@/app/actions/news';

export default function EditNewsPage() {
    const params = useParams();
    const id = Number(params.id);
    const [news, setNews] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (id) {
            getNewsById(id).then((data) => {
                setNews(data);
                setLoading(false);
            });
        }
    }, [id]);

    if (loading) return <div className="p-8 text-center">Carregando...</div>;

    if (!news) return <div className="p-8 text-center">Notícia não encontrada.</div>;

    return (
        <div className="p-4 md:p-8 max-w-4xl mx-auto">
            <Link href="/news" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6">
                <ArrowLeft size={16} /> Voltar
            </Link>

            <h1 className="text-2xl md:text-3xl font-bold mb-8">Editar Notícia</h1>

            <NewsForm initialData={news} />
        </div>
    );
}
