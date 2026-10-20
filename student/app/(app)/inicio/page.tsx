import { Suspense } from 'react';
import { FireEventOnce } from '@/components/analytics/fire-event-once';
import { RefreshError } from '@/components/refresh-error';
import { getProfile } from '@/lib/me';
import { getFeed, loadAuthors } from '@/lib/feed';
import { InicioFeed } from './inicio-feed';
import { SalasDeProvaSection } from './salas-de-prova-section';

export const metadata = { title: 'Início · Kixi' };

/**
 * O início: as salas de prova que pedem ação, o compositor e o feed da turma, na coluna central.
 * Os widgets estão na coluna da direita, global (ver `(app)/layout.tsx`).
 *
 * As salas e a coluna lateral chegam por Suspense: nenhuma delas bloqueia o feed principal.
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

  const feed = classId ? await getFeed(classId) : null;
  const posts = feed?.ok ? feed.data : [];
  const authors = await loadAuthors(posts, me.accountId);

  return (
    <>
      <FireEventOnce param="matriculado" event="onboarding_completed" />
      <Suspense fallback={null}><SalasDeProvaSection /></Suspense>
      <InicioFeed
        myAccountId={me.accountId}
        classId={classId}
        posts={posts}
        authors={authors}
        feedError={feed && !feed.ok ? feed.message : null}
      />
    </>
  );
}
