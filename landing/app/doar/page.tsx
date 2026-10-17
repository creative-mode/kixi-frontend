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
  alternates: { canonical: '/doar' },
  robots: { index: true, follow: true },
  openGraph: { title: TITLE, description: DESCRIPTION, url: '/doar', locale: 'pt_AO', type: 'website', siteName: 'Kixi' },
  twitter: { card: 'summary', title: TITLE, description: DESCRIPTION },
};

export default function Donate() {
  return (
    <div className="dn-stage">
      <a href="#conteudo" className="skip">Saltar para o conteúdo</a>
      <header className="dn-top">
        <Link href="/" aria-label="Kixi, início" className="site-header__logo">
          <Logo size={28} wordmark />
        </Link>
      </header>
      <main id="conteudo" tabIndex={-1} className="dn-main">
        <section className="dn-pitch" aria-labelledby="dn-h1">
          <h1 id="dn-h1" className="dn-title">
            Cada prova antiga<span> é um nível novo.</span>
          </h1>
          <p className="dn-lead">
            Uma foto ou um PDF chega. Nós tratamos do resto.
          </p>
        </section>
        <DonationForm />
      </main>
    </div>
  );
}
