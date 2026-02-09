'use client';

import { PostForm } from '@/components/posts/post-form';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function NewPostPage() {
    return (
        <div className="p-4 md:p-8 max-w-4xl mx-auto">
            <Link href="/posts" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6">
                <ArrowLeft size={16} /> Voltar
            </Link>

            <h1 className="text-2xl md:text-3xl font-bold mb-8">Criar Novo Post</h1>

            <PostForm />
        </div>
    );
}
