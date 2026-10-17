import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CrudForm } from '@/components/crud/crud-form';
import { entityByPath } from '@/lib/crud/entities';

export async function generateMetadata({ params }: { params: Promise<{ entity: string; id: string }> }): Promise<Metadata> {
  const entity = entityByPath((await params).entity);
  return { title: entity ? `Editar ${entity.singular.toLowerCase()} · Kixi Manager` : 'Não encontrado · Kixi Manager' };
}

export default async function EditPage({ params }: { params: Promise<{ entity: string; id: string }> }) {
  const { entity: path, id } = await params;
  const entity = entityByPath(path);
  if (!entity || !entity.canEdit) notFound();
  return <CrudForm entityKey={entity.key} id={decodeURIComponent(id)} />;
}
