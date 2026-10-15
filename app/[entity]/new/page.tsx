import { notFound } from 'next/navigation';
import { CrudForm } from '@/components/crud/crud-form';
import { QuickAssign } from '@/components/exam/quick-assign';
import { entityByPath } from '@/lib/crud/entities';

export default async function NewPage({ params }: { params: Promise<{ entity: string }> }) {
  const entity = entityByPath((await params).entity);
  if (!entity || !entity.canCreate) notFound();
  // Uma atribuição só é válida dentro da estrutura da escola: criam-se pelo seletor em cascata.
  if (entity.key === 'teaching-assignments') return <QuickAssign />;
  return <CrudForm entityKey={entity.key} />;
}
