'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { getSchoolYearById } from '@/app/actions/school-year';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Edit, ArrowLeft, Calendar, Clock, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { DetailSkeleton } from '@/components/crud/loading';
import type { SchoolYearResponse } from '@/types/school-year';

export default function SchoolYearDetailsPage() {
  const params = useParams();
  const id = Number(params.id);
  const [schoolYear, setSchoolYear] = useState<SchoolYearResponse | null>(null);
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
    return (
      <div className="mx-auto max-w-4xl p-4 md:p-8"><DetailSkeleton /></div>
    );
  }

  if (!schoolYear) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <Calendar size={40} className="mx-auto mb-3 text-muted-foreground" />
        <p>Ano letivo não encontrado.</p>
        <Button asChild variant="outline" size="sm" className="mt-4">
          <Link href="/school-year">Voltar para lista</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <Link
          href="/school-year"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft size={16} /> Voltar para lista
        </Link>

        <Link href={`/school-year/${schoolYear.id}/edit`}>
          <Button variant="outline" size="sm" className="border-border text-muted-foreground hover:text-foreground hover:border-primary">
            <Edit size={16} className="mr-2" /> Editar
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader className="border-b border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-md bg-warning-soft text-warning">
              <Calendar size={20} />
            </div>
            <CardTitle className="text-2xl text-foreground">
              {schoolYear.startYear} – {schoolYear.endYear}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="p-4 rounded-lg bg-accent border border-border">
              <h3 className="text-xs font-medium text-muted-foreground mb-1">Ano de início</h3>
              <p className="text-2xl font-bold text-foreground">{schoolYear.startYear}</p>
            </div>
            <div className="p-4 rounded-lg bg-accent border border-border">
              <h3 className="text-xs font-medium text-muted-foreground mb-1">Ano de fim</h3>
              <p className="text-2xl font-bold text-foreground">{schoolYear.endYear}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 border-t border-border pt-8 mt-8">
            <div className="flex items-start gap-3">
              <Clock size={16} className="text-muted-foreground mt-0.5" />
              <div>
                <h3 className="text-xs font-medium text-muted-foreground">Criado em</h3>
                <p className="mt-1 text-sm text-foreground">
                  {format(new Date(schoolYear.createdAt), "dd 'de' MMMM 'de' yyyy, HH:mm", {
                    locale: pt,
                  })}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <RefreshCw size={16} className="text-muted-foreground mt-0.5" />
              <div>
                <h3 className="text-xs font-medium text-muted-foreground">Última atualização</h3>
                <p className="mt-1 text-sm text-foreground">
                  {format(new Date(schoolYear.updatedAt), "dd 'de' MMMM 'de' yyyy, HH:mm", {
                    locale: pt,
                  })}
                </p>
              </div>
            </div>
            {schoolYear.deletedAt && (
              <div className="flex items-start gap-3">
                <Calendar size={16} className="text-destructive mt-0.5" />
                <div>
                  <h3 className="text-xs font-medium text-destructive">Eliminado em</h3>
                  <p className="mt-1 text-sm text-destructive">
                    {format(new Date(schoolYear.deletedAt), "dd 'de' MMMM 'de' yyyy, HH:mm", {
                      locale: pt,
                    })}
                  </p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
