import { redirect } from 'next/navigation';
import { getProfile } from '@/lib/me';
import { requireStudent } from '@/lib/guard';
import { MeProvider } from '@/lib/me-context';
import { Shell } from '@/components/Shell';
import { RightRail } from '@/components/right-rail';
import { loadSocial } from '@/lib/social';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireStudent();

  const profile = await getProfile();
  if (profile.kind === 'unauthorized') {
    redirect('/entrar?reason=session-expired');
  }

  // Feed, ranking and proofs are scoped to the student's class, so an account with no
  // enrollment has nothing to show until it picks one. Only an answer we actually got
  // from the backend can send them to onboarding; an unreachable one lets them in.
  if (profile.kind === 'ok' && !profile.me.currentClass) {
    redirect('/onboarding');
  }

  // A coluna da direita é global; sem resposta do backend, o Shell mostra só o conteúdo.
  const social = profile.kind === 'ok' ? await loadSocial(profile.me) : null;

  return (
    <MeProvider me={profile.me}>
      <Shell rail={social && profile.kind === 'ok' ? <RightRail me={profile.me} data={social} /> : undefined}>{children}</Shell>
    </MeProvider>
  );
}