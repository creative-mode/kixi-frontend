import { getCurrentUser } from '@/lib/auth.server';
import { RoomsList } from '@/components/exam-rooms/rooms-list';
import { InstitutionRoomsList } from '@/components/exam-rooms/institution-rooms-list';

export const metadata = { title: 'Salas de prova · Kixi Manager' };

export default async function ExamRoomsPage() {
  const user = await getCurrentUser();
  const admin = user?.roles.includes('ADMIN') ?? false;
  return admin ? <InstitutionRoomsList /> : <RoomsList />;
}
