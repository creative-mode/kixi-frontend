'use client';

import { useState, useEffect } from 'react';
import { getPosts, deletePost } from '@/app/actions/posts';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useDebounce } from '@/hooks/use-debounce';
import { Input } from '@/components/ui/input';
import { Search, Plus, Eye, MessageSquare, ThumbsUp, Edit, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

export default function PostsManager() {
    const [posts, setPosts] = useState<any[]>([]);
    const [search, setSearch] = useState('');
    const debouncedSearch = useDebounce(search, 500);

    useEffect(() => {
        loadPosts();
    }, [debouncedSearch]);

    const loadPosts = () => {
        getPosts(debouncedSearch).then(setPosts);
    };

    const handleDelete = async (id: number) => {
        const result = await deletePost(id);
        if (result.success) {
            toast.success('Post excluído com sucesso');
            loadPosts();
        } else {
            toast.error(result.error || 'Erro ao excluir post');
        }
    };

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-2xl md:text-3xl font-bold">Blog Posts</h1>
                <Link href="/posts/new">
                    <Button className="gap-2">
                        <Plus size={18} />
                        <span className="hidden md:inline">Novo Post</span>
                    </Button>
                </Link>
            </div>

            <div className="mb-6 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={18} />
                <Input
                    placeholder="Buscar posts..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-10"
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {posts.map((post) => (
                    <Card key={post.id} className="overflow-hidden group">
                        {post.coverUrl && (
                            <div className="relative h-48 overflow-hidden">
                                <img
                                    src={post.coverUrl}
                                    alt={post.title}
                                    className="w-full h-full object-cover transition-transform group-hover:scale-105"
                                />
                            </div>
                        )}
                        <CardContent className="p-6">
                            <h3 className="font-bold text-lg mb-2 line-clamp-1">{post.title}</h3>
                            <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{post.content}</p>

                            <div className="flex items-center gap-4 text-xs text-muted-foreground mb-4">
                                <span className="flex items-center gap-1"><Eye size={12} /> {post._count?.views || 0}</span>
                                <span className="flex items-center gap-1"><MessageSquare size={12} /> {post._count?.comments || 0}</span>
                                <span className="flex items-center gap-1"><ThumbsUp size={12} /> {post._count?.likes || 0}</span>
                            </div>

                            <div className="flex justify-end gap-2">
                                <Link href={`/posts/${post.id}`}>
                                    <Button variant="outline" size="sm" className="gap-1">
                                        <Eye size={14} /> Ver
                                    </Button>
                                </Link>
                                <Link href={`/posts/${post.id}/edit`}>
                                    <Button variant="outline" size="sm" className="gap-1">
                                        <Edit size={14} /> Editar
                                    </Button>
                                </Link>
                                <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => handleDelete(post.id)}
                                    className="gap-1"
                                >
                                    <Trash2 size={14} />
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                ))}
                {posts.length === 0 && (
                    <div className="col-span-full text-center py-12 text-muted-foreground">
                        Nenhum post encontrado.
                    </div>
                )}
            </div>
        </div>
    );
}
