import { redirect } from 'next/navigation';
import { getProfile } from '@/lib/me';
import { entrarUrl, requireStudent } from '@/lib/guard';
import { MeProvider } from '@/lib/me-context';
import { Shell } from '@/components/Shell';
import { RightRail } from '@/components/right-rail';
import { RightRailSkeleton } from '@/components/right-rail-skeleton';
import { loadSocial } from '@/lib/social';
import type { Me } from '@/lib/types';
import { Suspense } from 'react';
import { appOrigin } from '@/lib/origin';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireStudent();

  const profile = await getProfile();
  if (profile.kind === 'unauthorized') {
    redirect(await entrarUrl('session-expired'));
  }

  // Feed, ranking and proofs are scoped to the student's class, so an account with no
  // enrollment has nothing to show until it picks one. Only an answer we actually got
  // from the backend can send them to onboarding; an unreachable one lets them in.
  if (profile.kind === 'ok' && !profile.me.currentClass) {
    redirect('/onboarding');
  }

  // A coluna da direita é global e custa 8 leituras: já não faz a página esperar por ela (#393).
  // Chega depois, em streaming, e o conteúdo aparece primeiro.

  return (
    <MeProvider me={profile.me}>
      <Shell
        landingOrigin={appOrigin()}
        rail={profile.kind === 'ok'
          ? <Suspense fallback={<RightRailSkeleton />}><Rail me={profile.me} /></Suspense>
          : undefined}
      >{children}</Shell>
    </MeProvider>
  );
}
/** A coluna da direita. Sem resposta do backend não mostra nada, em vez de levar a página consigo. */
async function Rail({ me }: { me: Me }) {
  const social = await loadSocial(me);
  return <RightRail me={me} data={social} />;
}
