'use client';

import { getCareers, deleteCareer, updateCareerStatus } from '@/app/actions/careers';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useDebounce } from '@/hooks/use-debounce';
import { Search, Plus, Calendar, Trash2, Edit } from 'lucide-react';

export default function CareersManager() {
  const [careers, setCareers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 500);

  useEffect(() => {
    loadCareers();
  }, [debouncedSearch]);

  const loadCareers = () => {
    getCareers(debouncedSearch).then(setCareers);
  };

  const handleDelete = async (id: number) => {
    const result = await deleteCareer(id);
    if (result.success) {
      toast.success('Submissão excluída');
      loadCareers();
    } else {
      toast.error(result.error || 'Erro ao excluir submissão');
    }
  };

  const handleStatusChange = async (id: number, status: string) => {
    const result = await updateCareerStatus(id, status);
    if (result.success) {
      toast.success('Status atualizado!');
      loadCareers();
    } else {
      toast.error(result.error || 'Erro ao atualizar status');
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl md:text-3xl font-bold">Carreiras</h1>
        <Link href="/careers/new">
          <Button className="gap-2">
            <Plus size={18} />
            <span className="hidden md:inline">Nova Submissão</span>
          </Button>
        </Link>
      </div>

      <div className="mb-6 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
        <Input
          placeholder="Buscar submissões..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {careers.map((c) => (
          <Card key={c.id} className="overflow-hidden">
            <CardContent className="p-4 flex flex-col h-full">
              <h3 className="font-bold text-lg mb-1 truncate">{c.name}</h3>
              <p className="text-sm text-muted-foreground mb-1 truncate">{c.position}</p>
              <p className="text-sm text-muted-foreground mb-2 truncate">{c.email}</p>
              <p className="text-xs text-muted-foreground mb-2 line-clamp-3">{c.motivation}</p>

              <div className="flex justify-between items-center mt-auto">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Calendar size={12} />
                  <span>{new Date(c.createdAt).toLocaleDateString('pt')}</span>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() =>
                      handleStatusChange(c.id, c.status === 'Pendente' ? 'Aprovado' : 'Pendente')
                    }
                  >
                    {c.status === 'Pendente' ? (
                      <span className="font-bold">P</span>
                    ) : (
                      <span className="font-bold">✓</span>
                    )}
                  </Button>

                  <Link href={`/careers/${c.id}/edit`}>
                    <Button variant="ghost" size="icon">
                      <Edit size={16} />
                    </Button>
                  </Link>

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(c.id)}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {careers.length === 0 && (
          <div className="col-span-full text-center py-12 text-muted-foreground">
            Nenhuma submissão recebida.
          </div>
        )}
      </div>
    </div>
  );
}
