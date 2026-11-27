import type { Metadata } from 'next';
import { JsonLd } from '@/components/JsonLd';
import { Audiences } from '@/components/sections/Audiences';
import { Faq } from '@/components/sections/Faq';
import { Footer } from '@/components/sections/Footer';
import { Header } from '@/components/sections/Header';
import { Hero } from '@/components/sections/Hero';
import { Mission } from '@/components/sections/Mission';
import { Modules } from '@/components/sections/Modules';
import { Flow } from '@/components/sections/Flow';
import { faqPageLd, organizationLd, serviceLd, webPageLd, webSiteLd } from '@/lib/structured-data';

const TITLE = 'Kixi · Estuda. Dispara. Domina.';
const DESCRIPTION =
  'O Kixi transforma cada prova num gémeo digital: simulações, um tutor de IA que conhece cada questão e uma rede de estudo entre escolas. Feito por alunos do ITEL, para alunos.';

/** #764: reavaliado e mantido dinâmico. A raiz varia com o cookie de sessão (o
 *  proxy redireciona quem tem sessão) e o `Vary: Cookie` que o diria não sobrevive
 *  à renderização — uma página estática/ISR com `s-maxage` deixaria uma cache
 *  partilhada servir a landing a quem já tem sessão. Enquanto o Caddy da frente
 *  não fizer cache, o custo é um render por pedido. */
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
        <Hero />
        <Flow />
        <Modules />
        <Audiences />
        <Mission />
        <Faq />
      </main>
      <Footer />
    </>
  );
}
