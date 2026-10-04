import { Logo } from '@/components/kixi';
import { EntrarForm } from '@/components/AuthForm';

export const metadata = { title: 'Entrar · Kixi' };

export default function Entrar() {
  return (
    <main className="screen kx-lcd" style={{ padding: '0 24px 32px' }}>
      <div style={{ flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Logo size={96} wordmark layout="stacked" />
      </div>
      <EntrarForm />
    </main>
  );
}
