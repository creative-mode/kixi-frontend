import { AuthShell } from '@/components/AuthShell';
import { requireStudent } from '@/lib/guard';

/** Onboarding runs before there is a class, so it sits outside the (app) group and
 *  gets no navigation shell — only the session and role rules. */
export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  await requireStudent();

  return (
    <AuthShell title="Vamos começar" lead="Diz-nos em que curso e turma estás, para o teu feed e as tuas provas fazerem sentido.">
      {children}
    </AuthShell>
  );
}
