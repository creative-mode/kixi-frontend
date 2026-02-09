'use client';

import { useState, useEffect } from 'react';
import { getPostById } from '@/app/actions/posts';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Edit, Calendar, User } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

export default function PostDetailsPage() {
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
    if (!post) return <div className="p-8 text-center">Post não encontrado</div>;

    return (
        <div className="p-4 md:p-8 max-w-4xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <Link href="/posts" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground">
                    <ArrowLeft size={16} /> Voltar
                </Link>
                <Link href={`/posts/${id}/edit`}>
                    <Button className="gap-2">
                        <Edit size={16} /> Editar Post
                    </Button>
                </Link>
            </div>

            <article className="bg-card border rounded-xl overflow-hidden shadow-sm">
                {post.coverUrl && (
                    <div className="h-64 md:h-96 w-full relative">
                        <img
                            src={post.coverUrl}
                            alt={post.title}
                            className="w-full h-full object-cover"
                        />
                    </div>
                )}
                <div className="p-6 md:p-10">
                    <div className="flex flex-wrap gap-2 mb-4">
                        {post.tags.map((tag: string) => (
                            <span key={tag} className="px-2 py-1 bg-muted rounded-full text-xs font-medium border">
                                {tag}
                            </span>
                        ))}
                    </div>

                    <h1 className="text-3xl md:text-4xl font-bold mb-4">{post.title}</h1>

                    <div className="flex items-center gap-6 text-sm text-muted-foreground mb-8 border-b pb-8">
                        <div className="flex items-center gap-2">
                            <Calendar size={16} />
                            {new Date(post.publishedAt).toLocaleDateString('pt-PT', {
                                day: 'numeric',
                                month: 'long',
                                year: 'numeric'
                            })}
                        </div>
                        <div className="flex items-center gap-2">
                            <User size={16} />
                            {post.authorName || `Autor ID: ${post.authorId}`}
                        </div>
                    </div>

                    <div className="prose prose-invert max-w-none">
                        {post.content.split('\n').map((paragraph: string, index: number) => (
                            paragraph ? <p key={index} className="mb-4">{paragraph}</p> : <br key={index} />
                        ))}
                    </div>
                </div>
            </article>
        </div>
    );
}
