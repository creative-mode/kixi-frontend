import { AuthShell } from '@/components/AuthShell';
import { CadastroForm } from '@/components/AuthForm';
import { appOrigin } from '@/lib/origin';

export const metadata = { title: 'Criar conta · Kixi' };

export default function Cadastro() {
  const landingOrigin = appOrigin();
  return (
    <AuthShell title="Cria a tua conta" lead="Leva menos de um minuto." backToLanding>
      <p className="-mt-2 text-sm leading-relaxed text-muted-foreground">
        Se tens menos de 18 anos, só deves criar conta com o conhecimento e a autorização do teu encarregado de educação.{' '}
        <a href={`${landingOrigin ?? ''}/privacidade`} className="font-medium text-primary underline underline-offset-4 hover:text-foreground">
          Política de Privacidade
        </a>
      </p>
      <CadastroForm />
    </AuthShell>
  );
}
