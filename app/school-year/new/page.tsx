'use client';

import { SchoolYearForm } from '@/components/school-year/school-year-form'; // ajusta o caminho
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function NewSchoolYearPage() {
  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <Link
        href="/school-years"
        className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft size={16} /> Voltar para lista
      </Link>

      <h1 className="text-2xl md:text-3xl font-bold mb-8">
        Adicionar Novo Ano Letivo
      </h1>

      <SchoolYearForm />
    </div>
  );
}