'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { getSchoolYearById } from '@/app/actions/school-year'; // cria esta action se ainda não tens
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Edit, ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';

export default function SchoolYearDetailsPage() {
  const params = useParams();
  const id = Number(params.id);
  const [schoolYear, setSchoolYear] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      getSchoolYearById(id)
        .then((data) => {
          setSchoolYear(data);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  }, [id]);

  if (loading) {
    return <div className="text-center py-12 text-muted-foreground">A carregar...</div>;
  }

  if (!schoolYear) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Ano letivo não encontrado.
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <Link
          href="/school-years"
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft size={16} /> Voltar para lista
        </Link>

        <Link href={`/school-years/${schoolYear.id}/edit`}>
          <Button variant="outline" size="sm">
            <Edit size={16} className="mr-2" /> Editar
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">
            {schoolYear.startYear} – {schoolYear.endYear}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">Ano de início</h3>
              <p className="text-lg font-semibold mt-1">{schoolYear.startYear}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">Ano de fim</h3>
              <p className="text-lg font-semibold mt-1">{schoolYear.endYear}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 border-t pt-6">
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">Criado em</h3>
              <p className="mt-1">
                {format(new Date(schoolYear.createdAt), "dd 'de' MMMM 'de' yyyy, HH:mm", {
                  locale: pt,
                })}
              </p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">Última atualização</h3>
              <p className="mt-1">
                {format(new Date(schoolYear.updatedAt), "dd 'de' MMMM 'de' yyyy, HH:mm", {
                  locale: pt,
                })}
              </p>
            </div>
            {schoolYear.deletedAt && (
              <div className="text-destructive">
                <h3 className="text-sm font-medium">Eliminado em</h3>
                <p className="mt-1">
                  {format(new Date(schoolYear.deletedAt), "dd 'de' MMMM 'de' yyyy, HH:mm", {
                    locale: pt,
                  })}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}