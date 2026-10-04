import { notFound } from 'next/navigation';
import { CrudForm } from '@/components/crud/crud-form';
import { entityByPath } from '@/lib/crud/entities';

export default async function EditPage({ params }: { params: Promise<{ entity: string; id: string }> }) {
  const { entity: path, id } = await params;
  const entity = entityByPath(path);
  if (!entity || !entity.canEdit) notFound();
  return <CrudForm entityKey={entity.key} id={decodeURIComponent(id)} />;
}
