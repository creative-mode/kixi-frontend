import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CrudTrash } from '@/components/crud/crud-trash';
import { entityByPath } from '@/lib/crud/entities';

export async function generateMetadata({ params }: { params: Promise<{ entity: string }> }): Promise<Metadata> {
  const entity = entityByPath((await params).entity);
  return { title: entity ? `Reciclagem · ${entity.plural} · Kixi Manager` : 'Não encontrado · Kixi Manager' };
}

export default async function TrashPage({ params }: { params: Promise<{ entity: string }> }) {
  const entity = entityByPath((await params).entity);
  if (!entity) notFound();
  return <CrudTrash entityKey={entity.key} />;
}
