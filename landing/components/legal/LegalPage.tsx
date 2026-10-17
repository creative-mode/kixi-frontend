import Link from 'next/link';
import { Logo } from '@/components/kixi';

/** A moldura das páginas legais: cabeçalho com a marca, um título e o texto em coluna legível. */
export function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <div className="lg-stage">
      <a href="#conteudo" className="skip">Saltar para o conteúdo</a>
      <header className="lg-top">
        <Link href="/" aria-label="Kixi, início" className="site-header__logo"><Logo size={28} wordmark /></Link>
      </header>
      <main id="conteudo" tabIndex={-1} className="lg-main">
        <h1 className="lg-title">{title}</h1>
        <p className="lg-updated">Atualizado em {updated}</p>
        <div className="lg-body">{children}</div>
        <p className="lg-back"><Link href="/">Voltar ao início</Link></p>
      </main>
    </div>
  );
}
