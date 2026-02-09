'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getCareerById, updateCareerStatus } from '@/app/actions/careers';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function EditCareerPage() {
  const params = useParams();
  const router = useRouter();
  const id = Number(params.id);

  const [career, setCareer] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [statusLoading, setStatusLoading] = useState(false);

  useEffect(() => {
    if (id) {
      getCareerById(id).then((data) => {
        setCareer(data);
        setLoading(false);
      });
    }
  }, [id]);

  const handleStatusChange = async () => {
    if (!career) return;
    setStatusLoading(true);

    const newStatus = career.status === 'Pendente' ? 'Aprovado' : 'Pendente';
    const result = await updateCareerStatus(career.id, newStatus);

    if (result.success) {
      toast.success('Status atualizado!');
      setCareer({ ...career, status: newStatus });
    } else {
      toast.error(result.error || 'Erro ao atualizar status');
    }

    setStatusLoading(false);
  };

  if (loading) return <div className="p-8 text-center">Carregando...</div>;
  if (!career) return <div className="p-8 text-center">Submissão não encontrada.</div>;

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      {/* Header */}
      <Link
        href="/careers"
        className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft size={16} /> Voltar
      </Link>

      <h1 className="text-2xl md:text-3xl font-bold mb-8">
        Detalhes da Submissão
      </h1>

      {/* Info Card */}
      <div className="bg-card border rounded-xl p-6 space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="font-semibold text-lg">{career.name}</h2>
          <Button
            onClick={handleStatusChange}
            size="sm"
            disabled={statusLoading}
          >
            {career.status === 'Pendente' ? 'Marcar como Aprovado' : 'Marcar como Pendente'}
          </Button>
        </div>

        <p><span className="font-medium">E-mail:</span> {career.email}</p>
        <p><span className="font-medium">Telefone:</span> {career.phone}</p>
        <p><span className="font-medium">Cargo pretendido:</span> {career.position}</p>
        <p><span className="font-medium">Portfólio:</span> {career.portfolio || '-'}</p>
        <p><span className="font-medium">Experiência:</span> {career.experience}</p>
        <p><span className="font-medium">Motivação:</span> {career.motivation}</p>
        <p><span className="font-medium">IP Address:</span> {career.ipAddress}</p>
        <p><span className="font-medium">User Agent:</span> {career.userAgent}</p>
        <p><span className="font-medium">Criado em:</span> {new Date(career.createdAt).toLocaleString('pt')}</p>
        <p><span className="font-medium">Status:</span> {career.status}</p>
      </div>
    </div>
  );
}
