import { FireEventOnce } from '@/components/analytics/fire-event-once';
import { RefreshError } from '@/components/refresh-error';
import { getProfile } from '@/lib/me';
import { getFeed, loadAuthors } from '@/lib/feed';
import { MobileInicio, MobileInicioSkeleton } from '@/components/mobile-inicio';
import { Suspense } from 'react';
import { ProximaProva } from '@/components/proxima-prova';
import { loadSocial } from '@/lib/social';
import { loadFirstConversations } from '@/lib/comments';
import { FEED_PAGE_SIZE } from '@/lib/feed-pagination';
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

  const [feed, social] = await Promise.all([
    classId ? getFeed(classId, 1, FEED_PAGE_SIZE) : Promise.resolve(null),
    // `loadSocial` é `cache` do React: a coluna da direita reaproveita esta mesma leitura no pedido.
    loadSocial(me),
  ]);
  const posts = feed?.ok ? feed.data : [];
  const [authors, conversations] = await Promise.all([loadAuthors(posts, me.accountId), loadFirstConversations(posts)]);

  return (
    <>
      <FireEventOnce param="matriculado" event="onboarding_completed" />
      <InicioFeed
        myAccountId={me.accountId}
        classId={classId}
        posts={posts}
        authors={authors}
        conversations={conversations}
        feedError={feed && !feed.ok ? feed.message : null}
        mobileHighlights={<Suspense fallback={<MobileInicioSkeleton />}><MobileInicio me={me} /></Suspense>}
        topo={<ProximaProva invitations={social.invitations.ok ? social.invitations.data : []} data={social} serverNow={Date.now()} />}
      />
    </>
  );
}
