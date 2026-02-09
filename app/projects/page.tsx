'use client';

import { getProjects, deleteProject } from '@/app/actions/projects';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SearchInput } from '@/components/search-input';
import { Plus, ExternalLink, Edit, Trash2 } from 'lucide-react';
import Link from 'next/link';

// ...

export default function ProjectsManager() {
    const [projects, setProjects] = useState<any[]>([]);

    async function handleSearch(query: string) {
        const data = await getProjects(query);
        setProjects(data);
    }

    useEffect(() => {
        handleSearch(''); // Initial load
    }, []);

    async function handleDelete(id: number) {
        try {
            await deleteProject(id);
            toast.success('Projeto removido com sucesso');
            handleSearch('');
        } catch (error) {
            toast.error('Erro ao remover projeto');
        }
    }

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-2xl md:text-3xl font-bold">Gerenciar Projetos</h1>
                <Link href="/projects/new">
                    <Button className="gap-2">
                        <Plus size={18} />
                        <span className="hidden md:inline">Novo Projeto</span>
                    </Button>
                </Link>
            </div>

            <div className="mb-6">
                <SearchInput onSearch={handleSearch} />
            </div>

            <div className="space-y-4">
                {projects.map((p) => (
                    <Card key={p.id}>
                        <CardContent className="flex justify-between items-start p-6">
                            <div>
                                <div className="flex items-center gap-2 mb-2">
                                    <h3 className="font-bold">{p.name}</h3>
                                    <span
                                        className={`text-[10px] px-2 py-0.5 rounded-full ${p.status === 'ativo'
                                            ? 'bg-green-100 text-green-800'
                                            : p.status === 'em_desenvolvimento'
                                                ? 'bg-blue-100 text-blue-800'
                                                : 'bg-gray-100 text-gray-800'
                                            }`}
                                    >
                                        {p.status.replace('_', ' ')}
                                    </span>
                                </div>
                                <p className="text-sm text-muted-foreground mb-2">{p.description}</p>
                                {p.imageUrl && (
                                    <img
                                        src={p.imageUrl}
                                        alt={p.name}
                                        className="w-16 h-16 object-cover rounded mb-2"
                                    />
                                )}
                                <a
                                    href={p.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-blue-600 hover:underline flex items-center gap-1 mb-2"
                                >
                                    {p.url} <ExternalLink size={10} />
                                </a>
                                <div className="flex flex-wrap gap-1">
                                    {p.features.map((feature: string) => (
                                        <span key={feature} className="text-[10px] border px-1.5 py-0.5 rounded-full">
                                            {feature}
                                        </span>
                                    ))}
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <Link href={`/projects/${p.id}/edit`}>
                                    <Button variant="ghost" size="icon">
                                        <Edit size={16} />
                                    </Button>
                                </Link>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleDelete(p.id)}
                                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                >
                                    <Trash2 size={16} />
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                ))}
                {projects.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground">
                        Nenhum projeto cadastrado.
                    </div>
                )}
            </div>
        </div >
    );
}
