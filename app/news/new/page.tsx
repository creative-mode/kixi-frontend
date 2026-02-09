'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { NewsForm } from '@/components/news/news-form';

export default function NewNewsPage() {
    return (
        <div className="p-4 md:p-8 max-w-4xl mx-auto">
            <Link href="/news" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6">
                <ArrowLeft size={16} /> Voltar
            </Link>

            <h1 className="text-2xl md:text-3xl font-bold mb-8">Adicionar Nova Notícia</h1>

            <NewsForm />
        </div>
    );
}
