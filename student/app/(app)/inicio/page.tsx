import { redirect } from 'next/navigation';
import { getMyExamRooms } from '@/lib/exam-rooms';
import { InicioFeed } from './inicio-feed';

/**
 * The feed, with the exam rooms the student is on.
 *
 * The rooms are read here because they are the one thing on this screen that the
 * server owns: `GET /exam-rooms/mine` needs the session cookie and nothing in the
 * browser can ask for it. The rest of the feed is client state, which is why only
 * this list crosses the boundary.
 *
 * A failure reading the rooms does not take the feed with it. A student whose network
 * blinked still gets their morning; they simply do not see a section that is not
 * certain.
 */
export default async function InicioPage() {
  const rooms = await getMyExamRooms();

  if (rooms.kind === 'unauthorized') redirect('/entrar?reason=session-expired');

  return <InicioFeed rooms={rooms.kind === 'ok' ? rooms.rooms : []} />;
}
