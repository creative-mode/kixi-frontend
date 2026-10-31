import { AuthShell } from '@/components/AuthShell';

export const metadata = { title: 'Recuperar palavra-passe · Kixi' };

export default function Recuperar() {
  return (
    <AuthShell
      title="Recuperar palavra-passe"
      lead="A recuperação automática ainda não está disponível."
      backToLanding
    >
      <div role="note" className="rounded-md border border-primary/30 bg-primary/5 p-4 text-sm text-foreground">
        Contacta o teu professor ou a secretaria da escola para redefinir a palavra-passe. Não há um serviço automático disponível neste momento.
      </div>
    </AuthShell>
  );
}
