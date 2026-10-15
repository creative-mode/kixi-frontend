import { notFound } from 'next/navigation';
import { StructureEditor } from '@/components/academic/structure-editor';

export const metadata = { title: 'Estrutura da escola · Kixi Manager' };

export default async function StructurePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ nova?: string }> }) {
  const { id } = await params;
  const institutionId = Number(id);
  if (!Number.isInteger(institutionId) || institutionId <= 0) notFound();
  return <StructureEditor institutionId={institutionId} created={(await searchParams).nova === '1'} />;
}
