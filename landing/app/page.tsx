import type { Metadata } from 'next';
import { JsonLd } from '@/components/JsonLd';
import { Audiences } from '@/components/sections/Audiences';
import { Faq } from '@/components/sections/Faq';
import { Footer } from '@/components/sections/Footer';
import { Header } from '@/components/sections/Header';
import { Modules } from '@/components/sections/Modules';
import { Presentation } from '@/components/sections/Presentation';
import { faqPageLd, organizationLd, serviceLd, webPageLd, webSiteLd } from '@/lib/structured-data';

const TITLE = 'Kixi · Estuda. Dispara. Domina.';
const DESCRIPTION =
  'O Kixi transforma cada prova num gémeo digital: simulações, um tutor de IA que conhece cada questão e uma rede de estudo entre escolas. Feito por alunos do ITEL, para alunos.';

/** Sem cache partilhada (#522): varia com o cookie de sessão (redirecionamento) e o
 *  `Vary` que o diria não sobrevive à renderização — por isso renderiza sempre. */
export const dynamic = 'force-dynamic';

/** `twitter` repetir-se aqui é o que impede que o layout o ponha de fora: o Next
 *  substitui os campos do pai em vez de os juntar, e sem isto a raiz fica sem
 *  `twitter:card` nenhum. */
export const metadata: Metadata = {
  alternates: { canonical: '/' },
  robots: { index: true, follow: true },
  openGraph: { title: TITLE, description: DESCRIPTION, url: '/', locale: 'pt_AO', type: 'website', siteName: 'Kixi' },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION },
};

export default function Landing() {
  return (
    <>
      <JsonLd nodes={[organizationLd(), webSiteLd(), webPageLd(TITLE, '/', DESCRIPTION), serviceLd(), faqPageLd()]} />
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
