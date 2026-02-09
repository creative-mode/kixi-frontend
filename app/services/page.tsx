'use client';

import { getServices, deleteService } from '@/app/actions/services';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trash2, Plus, Edit } from 'lucide-react';
import Link from 'next/link';

export default function ServicesManager() {
    const [services, setServices] = useState<any[]>([]);

    useEffect(() => {
        getServices().then(setServices);
    }, []);

    async function handleDelete(id: number) {
        if (confirm('Tem certeza?')) {
            const result = await deleteService(id);
            if (result.success) {
                toast.success('Serviço deletado');
                getServices().then(setServices);
            } else {
                toast.error(result.error);
            }
        }
    }

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-2xl md:text-3xl font-bold">Gerenciar Serviços</h1>
                <Link href="/services/new">
                    <Button className="gap-2">
                        <Plus size={18} />
                        <span className="hidden md:inline">Novo Serviço</span>
                    </Button>
                </Link>
            </div>

            <div className="grid gap-4">
                {services.map((s) => (
                    <Card key={s.id}>
                        <CardContent className="flex justify-between items-start p-6">
                            <div>
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="text-xs font-mono bg-muted px-2 py-1 rounded">{s.num}</span>
                                    <h3 className="font-bold">{s.title}</h3>
                                </div>
                                <p className="text-sm text-muted-foreground mb-2">{s.description}</p>
                                <div className="flex flex-wrap gap-1">
                                    {s.tags.map((tag: string) => (
                                        <span key={tag} className="text-[10px] border px-1.5 py-0.5 rounded-full">
                                            {tag}
                                        </span>
                                    ))}
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <Link href={`/services/${s.id}/edit`}>
                                    <Button variant="ghost" size="icon">
                                        <Edit size={16} />
                                    </Button>
                                </Link>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleDelete(s.id)}
                                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                >
                                    <Trash2 size={16} />
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                ))}
                {services.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground">
                        Nenhum serviço cadastrado.
                    </div>
                )}
            </div>
        </div>
    );
}
