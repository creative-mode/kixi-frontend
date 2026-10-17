import type { Metadata } from 'next';
import { Audiences } from '@/components/sections/Audiences';
import { Faq } from '@/components/sections/Faq';
import { Footer } from '@/components/sections/Footer';
import { Header } from '@/components/sections/Header';
import { Modules } from '@/components/sections/Modules';
import { Presentation } from '@/components/sections/Presentation';

export const metadata: Metadata = { alternates: { canonical: '/' } };

export default function Landing() {
  return (
    <>
      <a href="#conteudo" className="skip">Saltar para o conteúdo</a>
      <Header />
      <main id="conteudo" tabIndex={-1}>
        <Presentation />
        <div className="hatch" aria-hidden="true" />
        <Modules />
        <Audiences />
        <Faq />
      </main>
      <Footer />
    </>
  );
}
