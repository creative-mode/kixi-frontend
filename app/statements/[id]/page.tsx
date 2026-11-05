import { notFound } from 'next/navigation';
import { StatementDetail } from '@/components/crud/statement-detail';

export const metadata = { title: 'Rever enunciado · Kixi Manager' };

export default async function StatementPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  // «Aprovar e ir para o seguinte» abre o seguinte já em revisão (`?rever=1`); o `key` desmonta o anterior.
  const startReviewing = (await searchParams).rever === '1';
  return <StatementDetail key={id} id={id} startReviewing={startReviewing} />;
}
