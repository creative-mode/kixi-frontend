import { notFound } from 'next/navigation';
import { StatementDetail } from '@/components/crud/statement-detail';

export const metadata = { title: 'Rever enunciado · Kixi Manager' };

export default async function StatementPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  return <StatementDetail id={id} />;
}
