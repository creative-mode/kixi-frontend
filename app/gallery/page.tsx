'use client';

import { getGalleryImages, deleteGalleryImage } from '@/app/actions/gallery';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useDebounce } from '@/hooks/use-debounce';
import { Input } from '@/components/ui/input';
import { Search, Plus, Calendar, Edit, Trash2 } from 'lucide-react';
import Link from 'next/link';

// ...

export default function GalleryManager() {
    const [images, setImages] = useState<any[]>([]);
    const [search, setSearch] = useState('');
    const debouncedSearch = useDebounce(search, 500);

    useEffect(() => {
        loadImages();
    }, [debouncedSearch]);

    const loadImages = () => {
        getGalleryImages(debouncedSearch).then(setImages);
    };

    const handleDelete = async (id: number) => {
        const result = await deleteGalleryImage(id);
        if (result.success) {
            toast.success('Imagem excluída com sucesso');
            loadImages();
        } else {
            toast.error(result.error || 'Erro ao excluir imagem');
        }
    };

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-2xl md:text-3xl font-bold">Galeria</h1>
                <Link href="/gallery/new">
                    <Button className="gap-2">
                        <Plus size={18} />
                        <span className="hidden md:inline">Nova Imagem</span>
                    </Button>
                </Link>
            </div>

            <div className="mb-6 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={18} />
                <Input
                    placeholder="Buscar imagens..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-10"
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {images.map((image) => (
                    <Card key={image.id} className="overflow-hidden">
                        <img
                            src={image.imageUrl}
                            alt={image.title}
                            className="w-full h-48 object-cover"
                        />
                        <CardContent className="p-4">
                            <h3 className="font-bold text-lg mb-2 truncate">{image.title}</h3>
                            {image.description && (
                                <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                                    {image.description}
                                </p>
                            )}

                            {image.tags.length > 0 && (
                                <div className="flex flex-wrap gap-1 mb-3">
                                    {image.tags.map((tag: string) => (
                                        <span
                                            key={tag}
                                            className="text-[10px] border px-2 py-0.5 rounded-full bg-muted"
                                        >
                                            {tag}
                                        </span>
                                    ))}
                                </div>
                            )}

                            <div className="flex justify-between items-center mt-4">
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <Calendar size={12} />
                                    <span>
                                        {new Date(image.createdAt).toLocaleDateString('pt')}
                                    </span>
                                </div>
                                <div className="flex gap-2">
                                    <Link href={`/gallery/${image.id}/edit`}>
                                        <Button variant="ghost" size="icon">
                                            <Edit size={16} />
                                        </Button>
                                    </Link>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handleDelete(image.id)}
                                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                    >
                                        <Trash2 size={16} />
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
                {images.length === 0 && (
                    <div className="col-span-full text-center py-12 text-muted-foreground">
                        Nenhuma imagem na galeria. Adicione sua primeira imagem!
                    </div>
                )}
            </div>
        </div>
    );
}
