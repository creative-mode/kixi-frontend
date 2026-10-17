import { invitationsErrorOf } from '@/lib/exam-room-rules';
import { getMe } from '@/lib/me';
import { getFeed } from '@/lib/feed';
import { loadSocial } from '@/lib/social';
import { FriendsCard } from '@/components/social/friends-card';
import { ProfileCard } from '@/components/social/profile-card';
import { RightRail } from '@/components/social/right-rail';
import { SocialLayout } from '@/components/social/social-layout';
import { InicioFeed } from './inicio-feed';

/**
 * O início, em três colunas: o aluno e os amigos à esquerda, as salas de prova e o feed da turma
 * ao meio, e os widgets à direita.
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
    <SocialLayout identity={<ProfileCard me={me} data={social} />} friends={<FriendsCard friends={social.friends} />} rail={<RightRail data={social} />}>
      <InicioFeed
        invitations={invResult.ok ? invResult.data : []}
        invitationsError={invitationsErrorOf(invResult)}
        myAccountId={me.accountId}
        classId={classId}
        posts={feed?.ok ? feed.data : []}
        feedError={feed && !feed.ok ? feed.message : null}
      />
    </SocialLayout>
  );
}
