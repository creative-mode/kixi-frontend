import { AuthShell } from '@/components/AuthShell';
import { RecoverForm } from '@/components/RecoverForm';

export const metadata = { title: 'Recuperar palavra-passe · Kixi' };

export default function Recuperar() {
  return (
    <AuthShell
      title="Recuperar palavra-passe"
      lead="Indica o utilizador ou email da tua conta."
      backToLanding
    >
      <RecoverForm />
    </AuthShell>
  );
}
