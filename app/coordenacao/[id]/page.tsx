import { notFound } from 'next/navigation';
import { CoordinationRoomView } from '@/components/coordination/coordination-room-view';

export const metadata = { title: 'Detalhe da sala · Kixi Manager' };

export default async function CoordinationRoomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  return <CoordinationRoomView id={Number(id)} />;
}
