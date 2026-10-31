import type { Metadata } from 'next';
import Link from 'next/link';
import { Logo } from '@/components/kixi';
import { DonationForm } from '@/components/donate/DonationForm';
import '@/styles/donate.css';

const TITLE = 'Doa um enunciado · Kixi';
const DESCRIPTION =
  'Tens uma prova, um teste ou um exame antigo? Doa-o ao Kixi: uma foto ou um PDF chega para ajudar outros alunos a estudar.';

/** Cache partilhada (#522): HTML público igual para toda a gente. */
export const revalidate = 3600;

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/doar' },
  robots: { index: true, follow: true },
  openGraph: { title: TITLE, description: DESCRIPTION, url: '/doar', locale: 'pt_AO', type: 'website', siteName: 'Kixi' },
  // `summary` em vez de `summary_large_image` dava um cartão diferente do da raiz
  // na mesma partilha. A imagem é a da raiz (a única que existe); um cartão
  // `summary` que a descarta era pior do que o mesmo cartão nas duas rotas.
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION },
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
