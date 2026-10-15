import { ExamBuilder } from '@/components/exam/exam-builder';

export const metadata = { title: 'Montar prova · Kixi Manager' };

export default async function Page({ searchParams }: { searchParams: Promise<{ importar?: string }> }) {
  const params = await searchParams;
  return <ExamBuilder openImport={params.importar === '1'} />;
}
