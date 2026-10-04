'use client';

import { SchoolYearForm } from '@/components/school-year/school-year-form';
import { ArrowLeft, Plus } from 'lucide-react';
import Link from 'next/link';

export default function NewSchoolYearPage() {
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
          <Plus size={20} className="text-foreground" />
        </div>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">
            Novo Ano Letivo
          </h1>
          <p className="text-sm text-muted-foreground">Preencha os campos para criar um novo período letivo</p>
        </div>
      </div>

      <SchoolYearForm />
    </div>
  );
}