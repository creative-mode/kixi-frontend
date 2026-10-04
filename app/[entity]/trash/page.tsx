import { notFound } from 'next/navigation';
import { CrudTrash } from '@/components/crud/crud-trash';
import { entityByPath } from '@/lib/crud/entities';

export default async function TrashPage({ params }: { params: Promise<{ entity: string }> }) {
  const entity = entityByPath((await params).entity);
  if (!entity) notFound();
  return <CrudTrash entityKey={entity.key} />;
}
