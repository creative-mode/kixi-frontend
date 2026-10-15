import type { Metadata } from 'next';
import Link from 'next/link';
import { Logo } from '@/components/kixi';
import { Sprite } from '@/components/sections/Bug';
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
    <div className="dn-stage">
      <a href="#conteudo" className="skip">Saltar para o conteúdo</a>
      <header className="dn-top">
        <Link href="/doar" aria-label="Kixi, doação de enunciados" className="site-header__logo">
          <Logo size={28} wordmark />
        </Link>
        <span className="dn-top__tag">DOAÇÃO</span>
      </header>
      <main id="conteudo" tabIndex={-1} className="dn-main">
        <section className="dn-pitch" aria-labelledby="dn-h1">
          <div className="dn-sprites" aria-hidden="true">
            <Sprite kind="fly" width={34} className="dn-sprite dn-sprite--a" />
            <Sprite kind="moth" width={44} className="dn-sprite dn-sprite--b" />
            <Sprite kind="ship" width={52} className="dn-sprite dn-sprite--c" />
          </div>
          <p className="dn-eyebrow">Jogador 1, insere o cartucho</p>
          <h1 id="dn-h1" className="dn-title">
            Cada prova antiga<span> é um nível novo.</span>
          </h1>
          <p className="dn-lead">
            O Kixi transforma provas em simulações com correção na hora. Uma foto ou um PDF chega: nós tratamos do resto.
          </p>
          <ol className="dn-steps" aria-label="Como funciona">
            <li><strong>Envias</strong> as fotos ou o PDF</li>
            <li><strong>Revemos</strong> o enunciado</li>
            <li><strong>Publicamos</strong> para estudar</li>
          </ol>
          <p className="dn-credit">&copy; 2026 @creativemode</p>
        </section>
        <DonationForm />
      </main>
    </div>
  );
}
