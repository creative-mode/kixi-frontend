import { invitationsErrorOf } from '@/lib/exam-room-rules';
import { getMe } from '@/lib/me';
import { getFeed } from '@/lib/feed';
import { loadSocial } from '@/lib/social';
import { InicioFeed } from './inicio-feed';

/**
 * O início: as salas de prova que pedem ação, o compositor e o feed da turma, na coluna central.
 * Os widgets estão na coluna da direita, global (ver `(app)/layout.tsx`).
 *
 * Os convites leem-se aqui, no servidor, porque `GET /exam-rooms/mine` precisa do cookie da sessão.
 * Uma falha a ler as salas não leva o feed com ela. O feed social só se pede quando há turma: sem
 * matrícula não há `classId` para o `GET /feed/posts` exigir, e pedir sem ele dava 400.
 */
export default async function InicioPage() {
  const me = await getMe();
  if (!me) return null;
  const classId = me.currentClass?.id ?? null;

  const [feed, social] = await Promise.all([classId ? getFeed(classId) : Promise.resolve(null), loadSocial(me)]);
  const invResult = social.invitations;

  return (
    <InicioFeed
      invitations={invResult.ok ? invResult.data : []}
      invitationsError={invitationsErrorOf(invResult)}
      myAccountId={me.accountId}
      classId={classId}
      posts={feed?.ok ? feed.data : []}
      feedError={feed && !feed.ok ? feed.message : null}
    />
  );
}
