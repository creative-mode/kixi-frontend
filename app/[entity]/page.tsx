import { Suspense } from 'react';
import { CrudList } from '@/components/crud/crud-list';
import { entityByPath } from '@/lib/crud/entities';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

export async function generateMetadata({ params }: { params: Promise<{ entity: string }> }): Promise<Metadata> {
  const entity = entityByPath((await params).entity);
  return { title: entity ? `${entity.plural} · Kixi Manager` : 'Não encontrado · Kixi Manager' };
}

// A pesquisa, a ordenação e a página vivem no endereço (`?q=&sort=&dir=&page=`),
// que o componente lê no cliente: pede um `Suspense`.
export default async function EntityPage({ params }: { params: Promise<{ entity: string }> }) {
  const entity = entityByPath((await params).entity);
  if (!entity || entity.key === 'statements') notFound();
  return (
    <Suspense>
      <CrudList entityKey={entity.key} />
    </Suspense>
  );
}
