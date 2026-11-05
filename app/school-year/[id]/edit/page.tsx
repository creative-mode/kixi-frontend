'use client';

import { useParams } from 'next/navigation';
import { CrudForm } from '@/components/crud/crud-form';

export default function EditSchoolYearPage() {
  const params = useParams<{ id: string }>();
  return <CrudForm entityKey="school-years" id={decodeURIComponent(params.id)} />;
}
