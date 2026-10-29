import type { Metadata } from 'next';
import Link from 'next/link';
import { Footer } from '@/components/sections/Footer';
import { Header } from '@/components/sections/Header';
import { LOGIN_URL } from '@/lib/content';

export const metadata: Metadata = {
  title: 'Página não encontrada · Kixi',
  description: 'O endereço não existe ou a página mudou de sítio. Volta ao início do Kixi.',
  // Um 404 indexado guarda um beco no buscador: quem chega de um link partido
  // vê a mesma porta fechada para sempre.
  robots: { index: false, follow: false },
};

function button(href: string, label: string) {
  return (
    <span className="kx-btn-wrap kx-scope">
      <Link href={href} className="kx-btn kx-btn--lg" style={{ textDecoration: 'none' }}>
        <span className="kx-btn__label">{label}</span>
      </Link>
    </span>
  );
}

/** 404 da landing: endereço errado ou página movida (#544), na mesma identidade do
 *  site - cabeçalho, tipografia e botões - e com saída clara, em vez do ecrã em
 *  branco do 404 de omissão do Next, que era o que o visitante via em produção. */
export default function NotFound() {
  return (
    <div className="wrap nf">
      <a href="#conteudo" className="skip">Saltar para o conteúdo</a>
      <Header />
      <main id="conteudo" tabIndex={-1} className="lp-stack">
        <p className="nf__code">ERRO 404</p>
        <h1 className="nf__title">Esta página não existe</h1>
        <p className="nf__message">
          O endereço está incompleto, a página mudou de sítio ou já não está disponível.
          Volta ao início e continua a estudar.
        </p>
        <div className="actions nf__actions">
          {button('/', 'Ir para o início')}
          {button(LOGIN_URL, 'Entrar')}
        </div>
      </main>
      {/* A folga em baixo é para o banner de cookies fixo nunca ficar por cima de
          nada do que esta página tem para dizer (#544). */}
      <div style={{ paddingBottom: 128 }} />
      <Footer />
    </div>
  );
}
