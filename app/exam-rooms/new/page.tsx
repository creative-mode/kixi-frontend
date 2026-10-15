import { RoomWizard } from '@/components/exam-rooms/room-wizard';

export default async function NewExamRoomPage({ searchParams }: { searchParams: Promise<{ statementId?: string }> }) {
  const params = await searchParams;
  return <RoomWizard initialStatementId={params.statementId ?? null} />;
}
