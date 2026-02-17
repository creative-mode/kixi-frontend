'use client';

import { SchoolYearForm } from '@/components/school-year/school-year-form';
import { getSchoolYearById } from '@/app/actions/school-year';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function EditSchoolYearPage() {
  const params = useParams();
  const id = Number(params.id);
  const [schoolYear, setSchoolYear] = useState<any>(null);
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
    return <div className="p-8 text-center">A carregar dados do ano letivo...</div>;
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
        href="/school-years"
        className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft size={16} /> Voltar para lista
      </Link>

      <h1 className="text-2xl md:text-3xl font-bold mb-8">
        Editar Ano Letivo: {schoolYear.startYear} – {schoolYear.endYear}
      </h1>

      <SchoolYearForm initialData={schoolYear} />
    </div>
  );
}