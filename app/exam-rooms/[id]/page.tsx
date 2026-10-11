import { notFound } from 'next/navigation';
import { RoomConsole } from '@/components/exam-rooms/room-console';

export default async function ExamRoomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  return <RoomConsole id={Number(id)} />;
}
