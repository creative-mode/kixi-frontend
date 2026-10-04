import { Audiences } from '@/components/sections/Audiences';
import { Faq } from '@/components/sections/Faq';
import { FinalCta, Footer } from '@/components/sections/FinalCta';
import { Header } from '@/components/sections/Header';
import { Hero } from '@/components/sections/Hero';
import { Anatomy } from '@/components/sections/Anatomy';
import { Preview } from '@/components/sections/Preview';
import { Problem } from '@/components/sections/Problem';
import { Vision } from '@/components/sections/Vision';

export default function Landing() {
  return (
    <>
      <a href="#conteudo" className="skip">Saltar para o conteúdo</a>
      <Header />
      <main id="conteudo">
        <Hero />
        <div className="hatch" aria-hidden="true" />
        <Anatomy />
        <div className="hatch" aria-hidden="true" />
        <Problem />
        <div className="hatch" aria-hidden="true" />
        <Preview />
        <div className="hatch" aria-hidden="true" />
        <Audiences />
        <div className="hatch" aria-hidden="true" />
        <Vision />
        <div className="hatch" aria-hidden="true" />
        <Faq />
        <div className="hatch" aria-hidden="true" />
        <FinalCta />
      </main>
      <Footer />
    </>
  );
}
