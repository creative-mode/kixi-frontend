import { AuthShell } from '@/components/AuthShell';
import { EntrarForm } from '@/components/AuthForm';

export const metadata = { title: 'Entrar · Kixi' };

export default function Entrar() {
  return (
    <AuthShell title="Entrar" lead="Usa o teu número de processo ou o teu email.">
      <EntrarForm />
    </AuthShell>
  );
}
