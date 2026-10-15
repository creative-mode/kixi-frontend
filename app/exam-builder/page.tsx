import { ExamBuilder } from '@/components/exam/exam-builder';
import { donationParam } from '@/lib/donations/model';

export const metadata = { title: 'Montar prova · Kixi Manager' };

export default async function Page({ searchParams }: { searchParams: Promise<{ importar?: string; donation?: string }> }) {
  const params = await searchParams;
  return <ExamBuilder openImport={params.importar === '1'} donationId={donationParam(params.donation)} />;
}
