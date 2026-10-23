import { AuthShell } from '@/components/AuthShell';
import { requireStudent } from '@/lib/guard';

/** Onboarding runs before there is a class, so it sits outside the (app) group and
 *  gets no navigation shell — only the session and role rules. */
export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  await requireStudent();

  return (
    <AuthShell title="Vamos começar" lead="Introduz o código que a tua escola te deu para entrares na tua turma.">
      {children}
    </AuthShell>
  );
}
