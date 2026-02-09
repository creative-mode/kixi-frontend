'use client';

import {
    getTestimonials,
    deleteTestimonial,
} from '@/app/actions/testimonials';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { useDebounce } from '@/hooks/use-debounce';

import {
    Search,
    Plus,
    Calendar,
    Edit,
    Trash2,
    Quote,
} from 'lucide-react';

import Link from 'next/link';

export default function TestimonialsManager() {
    const [testimonials, setTestimonials] = useState<any[]>([]);
    const [search, setSearch] = useState('');
    const debouncedSearch = useDebounce(search, 500);

    useEffect(() => {
        loadTestimonials();
    }, [debouncedSearch]);

    const loadTestimonials = () => {
        getTestimonials().then((data) => {
            if (!debouncedSearch) {
                setTestimonials(data);
                return;
            }

            const filtered = data.filter((t: any) =>
                t.name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
                t.headline.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
                t.content.toLowerCase().includes(debouncedSearch.toLowerCase())
            );

            setTestimonials(filtered);
        });
    };

    const handleDelete = async (id: number) => {
        const result = await deleteTestimonial(id);

        if (result.success) {
            toast.success('Testemunho excluído com sucesso');
            loadTestimonials();
        } else {
            toast.error(result.error || 'Erro ao excluir testemunho');
        }
    };

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-2xl md:text-3xl font-bold">
                    Testemunhos
                </h1>
                <Link href="/testimonials/new">
                    <Button className="gap-2">
                        <Plus size={18} />
                        <span className="hidden md:inline">
                            Novo Testemunho
                        </span>
                    </Button>
                </Link>
            </div>

            {/* Search */}
            <div className="mb-6 relative">
                <Search
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    size={18}
                />
                <Input
                    placeholder="Buscar testemunhos..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-10"
                />
            </div>

            {/* Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {testimonials.map((t) => (
                    <Card key={t.id} className="relative overflow-hidden">
                        <CardContent className="p-6 flex flex-col h-full">
                            {/* Avatar */}
                            <div className="flex items-center gap-4 mb-4">
                                <img
                                    src={t.imageUrl}
                                    alt={t.name}
                                    className="w-12 h-12 aspect-square rounded-full object-cover border"
                                />
                                <div>
                                    <p className="font-semibold leading-tight">
                                        {t.name}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        {t.position}
                                    </p>
                                </div>
                            </div>

                            {/* Headline */}
                            <h3 className="font-bold text-lg mb-2 line-clamp-2">
                                “{t.headline}”
                            </h3>

                            {/* Content */}
                            <p className="text-sm text-muted-foreground line-clamp-4 flex-1">
                                {t.content}
                            </p>

                            {/* Footer */}
                            <div className="flex justify-between items-center mt-6">
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <Calendar size={12} />
                                    <span>
                                        {new Date(t.createdAt).toLocaleDateString('pt')}
                                    </span>
                                </div>

                                <div className="flex gap-2">
                                    <Link href={`/testimonials/${t.id}/edit`}>
                                        <Button variant="ghost" size="icon">
                                            <Edit size={16} />
                                        </Button>
                                    </Link>

                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handleDelete(t.id)}
                                        className="text-destructive hover:bg-destructive/10"
                                    >
                                        <Trash2 size={16} />
                                    </Button>
                                </div>
                            </div>

                            {/* Quote Icon */}
                            <Quote
                                size={64}
                                className="absolute -top-4 -right-4 text-muted/20"
                            />
                        </CardContent>
                    </Card>
                ))}

                {testimonials.length === 0 && (
                    <div className="col-span-full text-center py-12 text-muted-foreground">
                        Nenhum testemunho cadastrado. Adicione o primeiro!
                    </div>
                )}
            </div>
        </div>
    );
}
