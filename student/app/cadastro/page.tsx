import { Logo } from '@/components/kixi';
import { CadastroForm } from '@/components/AuthForm';

export const metadata = { title: 'Criar conta · Kixi' };

export default function Cadastro() {
  return (
    <main className="screen kx-lcd" style={{ padding: '24px 24px 32px', overflowY: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0 20px' }}>
        <Logo size={56} wordmark layout="stacked" />
      </div>
      <h1 style={{ margin: '0 0 16px', textAlign: 'center', font: '700 22px/28px var(--font-sans)' }}>Cria a tua conta</h1>
      <CadastroForm />
    </main>
  );
}
