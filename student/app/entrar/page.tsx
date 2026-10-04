import { AuthShell } from '@/components/AuthShell';
import { EntrarForm } from '@/components/AuthForm';

export const metadata = { title: 'Entrar · Kixi' };

export default function Entrar() {
  return (
    <AuthShell title="Entrar" sub="Continua a estudar onde ficaste.">
      <EntrarForm />
    </AuthShell>
  );
}
