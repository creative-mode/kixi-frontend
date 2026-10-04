import { notFound } from 'next/navigation';
import { CrudForm } from '@/components/crud/crud-form';
import { entityByPath } from '@/lib/crud/entities';

export default async function NewPage({ params }: { params: Promise<{ entity: string }> }) {
  const entity = entityByPath((await params).entity);
  if (!entity || !entity.canCreate) notFound();
  return <CrudForm entityKey={entity.key} />;
}
