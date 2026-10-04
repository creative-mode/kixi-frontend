import { Audiences } from '@/components/sections/Audiences';
import { Footer } from '@/components/sections/Footer';
import { Header } from '@/components/sections/Header';
import { Presentation } from '@/components/sections/Presentation';

export default function Landing() {
  return (
    <>
      <a href="#conteudo" className="skip">Saltar para o conteúdo</a>
      <Header />
      <main id="conteudo">
        <Presentation />
        <div className="hatch" aria-hidden="true" />
        <Audiences />
      </main>
      <Footer />
    </>
  );
}
