import { RoomWizard } from '@/components/exam-rooms/room-wizard';

export const metadata = { title: 'Nova sala de prova · Kixi Manager' };

export default async function NewExamRoomPage({ searchParams }: { searchParams: Promise<{ statementId?: string }> }) {
  const params = await searchParams;
  return <RoomWizard initialStatementId={params.statementId ?? null} />;
}
