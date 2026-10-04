import { notFound } from 'next/navigation';
import { CrudList } from '@/components/crud/crud-list';
import { entityByPath } from '@/lib/crud/entities';

export default async function EntityPage({ params }: { params: Promise<{ entity: string }> }) {
  const entity = entityByPath((await params).entity);
  if (!entity || entity.key === 'statements') notFound();
  return <CrudList entityKey={entity.key} />;
}
