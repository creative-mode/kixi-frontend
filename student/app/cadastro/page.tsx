import { AuthShell } from '@/components/AuthShell';
import { CadastroForm } from '@/components/AuthForm';

export const metadata = { title: 'Criar conta · Kixi' };

export default function Cadastro() {
  return (
    <AuthShell title="Cria a tua conta" sub="Leva um minuto. Estuda, dispara, domina." wide>
      <CadastroForm />
    </AuthShell>
  );
}
