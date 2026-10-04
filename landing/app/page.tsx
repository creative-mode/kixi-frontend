import { Audiences } from '@/components/sections/Audiences';
import { Difference } from '@/components/sections/Difference';
import { Faq } from '@/components/sections/Faq';
import { FinalCta, Footer } from '@/components/sections/FinalCta';
import { Header } from '@/components/sections/Header';
import { Hero } from '@/components/sections/Hero';
import { Modules } from '@/components/sections/Modules';
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
        <Problem />
        <Modules />
        <Preview />
        <Audiences />
        <Difference />
        <Vision />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
    </>
  );
}
