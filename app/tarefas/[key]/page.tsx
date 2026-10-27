import { TarefaForm } from '@/components/schoolops/tarefa-form';

export const metadata = { title: 'Tarefa da pauta · Kixi Manager' };

export default async function TarefaPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  return <TarefaForm chave={key} />;
}
