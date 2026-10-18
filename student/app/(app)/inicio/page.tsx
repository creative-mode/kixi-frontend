import { invitationsErrorOf } from '@/lib/exam-room-rules';
import { FireEventOnce } from '@/components/analytics/fire-event-once';
import { RefreshError } from '@/components/refresh-error';
import { getProfile } from '@/lib/me';
import { getFeed, loadAuthors } from '@/lib/feed';
import { loadSocial } from '@/lib/social';
import { InicioFeed } from './inicio-feed';

export const metadata = { title: 'Início · Kixi' };

/**
 * O início: as salas de prova que pedem ação, o compositor e o feed da turma, na coluna central.
 * Os widgets estão na coluna da direita, global (ver `(app)/layout.tsx`).
 *
 * Os convites leem-se aqui, no servidor, porque `GET /exam-rooms/mine` precisa do cookie da sessão.
 * Uma falha a ler as salas não leva o feed com ela. O feed social só se pede quando há turma: sem
 * matrícula não há `classId` para o `GET /feed/posts` exigir, e pedir sem ele dava 400.
 */
export default async function InicioPage() {
  const profile = await getProfile();
  // Sem o perfil não há turma nem feed. Antes devolvia-se `null` e o aluno ficava com a página em
  // branco quando o servidor caía; agora vê o motivo e pode tentar de novo (#350).
  if (profile.kind !== 'ok') {
    return (
      <>
        <FireEventOnce param="matriculado" event="onboarding_completed" />
        <RefreshError
          title="Não foi possível carregar o teu início"
          message="O servidor não respondeu a tempo. Tenta de novo — se continuar, fala com o teu professor."
        />
      </>
    );
  }
  const me = profile.me;
  const classId = me.currentClass?.id ?? null;

  const [feed, social] = await Promise.all([classId ? getFeed(classId) : Promise.resolve(null), loadSocial(me)]);
  const invResult = social.invitations;
  const posts = feed?.ok ? feed.data : [];
  const authors = await loadAuthors(posts, me.accountId);

  return (
    <>
      <FireEventOnce param="matriculado" event="onboarding_completed" />
      <InicioFeed
        invitations={invResult.ok ? invResult.data : []}
        invitationsError={invitationsErrorOf(invResult)}
        myAccountId={me.accountId}
        classId={classId}
        posts={posts}
        firstSteps={social.performance.activity.length === 0 && social.history.length === 0}
        authors={authors}
        feedError={feed && !feed.ok ? feed.message : null}
      />
    </>
  );
}
