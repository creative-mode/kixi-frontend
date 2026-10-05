import { AuthShell } from '@/components/AuthShell';
import { CadastroForm } from '@/components/AuthForm';

export const metadata = { title: 'Criar conta · Kixi' };

export default function Cadastro() {
  return (
    <AuthShell title="Cria a tua conta" lead="Leva menos de um minuto.">
      <CadastroForm />
    </AuthShell>
  );
}
