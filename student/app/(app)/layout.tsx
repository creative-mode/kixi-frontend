import { redirect } from 'next/navigation';
import { getProfile } from '@/lib/me';
import { entrarUrl, requireStudent } from '@/lib/guard';
import { MeProvider } from '@/lib/me-context';
import { ToastProvider } from '@/components/ui/toast';
import { Shell } from '@/components/Shell';
import { RightRail } from '@/components/right-rail';
import { RightRailSkeleton } from '@/components/right-rail-skeleton';
import { loadSocial } from '@/lib/social';
import { loadNotifications } from '@/lib/notifications';
import { listInvitations } from '@/lib/exam-room';
import { openRooms } from '@/lib/exam-room-rules';
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

  // O ponto da barra: só as fontes baratas (medalhas e resultados), para não custar leituras de conversas em cada página.
  // O contador das salas (#795) viaja na mesma vaga: são duas leituras em paralelo, uma vez por página.
  const [notifications, roomsOpen]: [{ unreadCount: number; unreadCorrections: number }, number] = profile.kind === 'ok'
    ? await Promise.all([
        loadNotifications(profile.me, false).catch(() => ({ unreadCount: 0, unreadCorrections: 0 })),
        roomsForNav(),
      ])
    : [{ unreadCount: 0, unreadCorrections: 0 }, 0];
  const unread = notifications.unreadCount;

  return (
    <MeProvider me={profile.me}>
      <ToastProvider>
      <Shell
        unread={unread}
        unreadCorrections={notifications.unreadCorrections}
        roomsOpen={roomsOpen}
        landingOrigin={appOrigin()}
        rail={profile.kind === 'ok'
          ? <Suspense fallback={<RightRailSkeleton />}><Rail me={profile.me} /></Suspense>
          : undefined}
      >{children}</Shell>
      </ToastProvider>
    </MeProvider>
  );
}
/** A coluna da direita. Sem resposta do backend não mostra nada, em vez de levar a página consigo. */
async function Rail({ me }: { me: Me }) {
  const social = await loadSocial(me);
  return <RightRail me={me} data={social} />;
}

/** As salas que já se podem abrir, para o contador da navegação (#795). Uma falha não é um número. */
async function roomsForNav(): Promise<number> {
  const rooms = await listInvitations().catch(() => null);
  return rooms?.ok ? openRooms(rooms.data).length : 0;
}
