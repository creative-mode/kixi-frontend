'use client';

import { SchoolYearForm } from '@/components/school-year/school-year-form';
import { getSchoolYearById } from '@/app/actions/school-year';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { ArrowLeft, Edit } from 'lucide-react';
import Link from 'next/link';
import { FormSkeleton } from '@/components/crud/loading';
import type { SchoolYearResponse } from '@/types/school-year';

export default function EditSchoolYearPage() {
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
      <div className="mx-auto max-w-3xl p-4 md:p-8"><FormSkeleton fields={2} /></div>
    );
  }

  if (!schoolYear) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Ano letivo não encontrado.
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <Link
        href="/school-year"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
      >
        <ArrowLeft size={16} /> Voltar para lista
      </Link>

      <div className="flex items-center gap-3 mb-8">
        <div className="p-2 rounded-lg bg-muted">
          <Edit size={20} className="text-foreground" />
        </div>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">
            Editar Ano Letivo
          </h1>
          <p className="text-sm text-muted-foreground">{schoolYear.startYear} – {schoolYear.endYear}</p>
        </div>
      </div>

      <SchoolYearForm initialData={schoolYear} />
    </div>
  );
}
