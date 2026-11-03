import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CrudList } from '@/components/crud/crud-list';
import { entityByPath } from '@/lib/crud/entities';

export async function generateMetadata({ params }: { params: Promise<{ entity: string }> }): Promise<Metadata> {
  const entity = entityByPath((await params).entity);
  return { title: entity ? `${entity.plural} · Kixi Manager` : 'Não encontrado · Kixi Manager' };
}

export default async function EntityPage({ params }: { params: Promise<{ entity: string }> }) {
  const entity = entityByPath((await params).entity);
  if (!entity || entity.key === 'statements') notFound();
  return <CrudList entityKey={entity.key} />;
}
