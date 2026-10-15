import type { Metadata } from 'next';
import Link from 'next/link';
import { Logo } from '@/components/kixi';
import { DonationForm } from '@/components/donate/DonationForm';
import '@/styles/donate.css';

const TITLE = 'Doa um enunciado · Kixi';
const DESCRIPTION =
  'Tens uma prova, um teste ou um exame antigo? Doa-o ao Kixi: uma foto ou um PDF chega para ajudar outros alunos a estudar.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/' },
  robots: { index: true, follow: true },
  openGraph: { title: TITLE, description: DESCRIPTION, locale: 'pt_AO', type: 'website', siteName: 'Kixi' },
  twitter: { card: 'summary', title: TITLE, description: DESCRIPTION },
};

export default function Donate() {
  return (
    <>
      <a href="#conteudo" className="skip">Saltar para o conteúdo</a>
      <header className="site-header">
        <div className="wrap site-header__in">
          <Link href="/doar" aria-label="Kixi, doação de enunciados" className="site-header__logo">
            <Logo size={28} wordmark />
          </Link>
        </div>
      </header>
      <main id="conteudo" tabIndex={-1} className="dn-main">
        <div className="wrap dn-wrap">
          <p className="dn-eyebrow">Doação de enunciados</p>
          <h1 className="dn-title">Uma prova antiga pode ajudar muitos alunos.</h1>
          <p className="dn-lead">
            O Kixi transforma provas em simulações com correção na hora. Para isso precisa de provas reais.
            Se tens um teste, uma prova ou um exame, uma foto ou um PDF chega: nós tratamos do resto.
          </p>
          <ol className="dn-steps" aria-label="Como funciona">
            <li><strong>Envias</strong> as fotos ou o PDF.</li>
            <li><strong>Revemos</strong> o enunciado.</li>
            <li><strong>Publicamos</strong> para os alunos estudarem.</li>
          </ol>
          <DonationForm />
        </div>
      </main>
      <footer className="footer" data-theme="dark">
        <div className="wrap footer__in">
          <Logo size={28} wordmark />
          <p className="footer__copy">&copy; 2026 @creativemode</p>
        </div>
      </footer>
    </>
  );
}
