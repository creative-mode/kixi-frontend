'use client';

import { PostForm } from '@/components/posts/post-form';
import { getPostById } from '@/app/actions/posts';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function EditPostPage() {
    const params = useParams();
    const id = Number(params.id);
    const [post, setPost] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (id) {
            getPostById(id).then((data) => {
                setPost(data);
                setLoading(false);
            });
        }
    }, [id]);

    if (loading) return <div className="p-8 text-center">Carregando...</div>;

    if (!post) return <div className="p-8 text-center">Post não encontrado.</div>;

    return (
        <div className="p-4 md:p-8 max-w-4xl mx-auto">
            <Link href="/posts" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6">
                <ArrowLeft size={16} /> Voltar
            </Link>

            <h1 className="text-2xl md:text-3xl font-bold mb-8">Editar Post</h1>

            <PostForm initialData={post} />
        </div>
    );
}
