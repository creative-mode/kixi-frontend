import Link from 'next/link';
import { Field, Logo } from '@/components/kixi';

export const metadata = { title: 'Entrar · Kixi' };

export default function Entrar() {
  return (
    <main className="screen kx-lcd" style={{ padding: '0 24px 32px' }}>
      <div style={{ flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Logo size={96} wordmark layout="stacked" />
      </div>
      <form className="stack" style={{ gap: 16 }}>
        <Field label="Número de processo" placeholder="ex.: 12345" inputMode="numeric" autoComplete="username" />
        <Field label="Palavra-passe" type="password" autoComplete="current-password" />
        <Link href="/entrar" style={{ alignSelf: 'flex-end', font: '600 14px/20px var(--font-sans)', padding: '4px 0' }}>Esqueceste a palavra-passe?</Link>
        <span className="kx-btn-wrap kx-btn-wrap--block kx-scope">
          <Link href="/inicio" className="kx-btn kx-btn--lg btnlink" style={{ font: '600 16px/1 var(--font-sans)' }}><span className="kx-btn__label">Entrar</span></Link>
        </span>
      </form>
      <p style={{ margin: '24px 0 0', textAlign: 'center', font: '400 14px/22px var(--font-sans)' }} className="muted">
        Ainda não tens conta? <Link href="/inicio" style={{ fontWeight: 600 }}>Criar conta</Link>
      </p>
    </main>
  );
}
