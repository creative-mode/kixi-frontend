'use client';

import { ProjectForm } from '@/components/projects/project-form';
import { getProjectById } from '@/app/actions/projects';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function EditProjectPage() {
    const params = useParams();
    const id = Number(params.id);
    const [project, setProject] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (id) {
            getProjectById(id).then((data) => {
                setProject(data);
                setLoading(false);
            });
        }
    }, [id]);

    if (loading) return <div className="p-8 text-center">Carregando...</div>;

    if (!project) return <div className="p-8 text-center">Projeto não encontrado.</div>;

    return (
        <div className="p-4 md:p-8 max-w-4xl mx-auto">
            <Link href="/projects" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6">
                <ArrowLeft size={16} /> Voltar
            </Link>

            <h1 className="text-2xl md:text-3xl font-bold mb-8">Editar Projeto</h1>

            <ProjectForm initialData={project} />
        </div>
    );
}
