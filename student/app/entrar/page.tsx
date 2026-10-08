import { AuthShell } from '@/components/AuthShell';
import { EntrarForm } from '@/components/AuthForm';

export const metadata = { title: 'Entrar · Kixi' };

type SearchParams = Promise<{ reason?: string }>;

function noticeFor(reason?: string) {
  if (reason === 'session-expired') {
    return 'A tua sessão expirou. Entra novamente para continuar.';
  }
  if (reason === 'logged-out') {
    return 'Sessão terminada com segurança.';
  }
  return undefined;
}

export default async function Entrar({ searchParams }: { searchParams: SearchParams }) {
  const { reason } = await searchParams;
  return (
    <AuthShell title="Entrar" lead="Usa o teu número de processo ou o teu email." notice={noticeFor(reason)}>
      <EntrarForm />
    </AuthShell>
  );
}
