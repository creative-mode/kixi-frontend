import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Footer } from '@/components/sections/Footer';
import { Header } from '@/components/sections/Header';
import { markdownToReact } from '@/lib/markdown-render';
import { TRUST_PAGES as PAGES, type TrustPath as PageKey } from '@/lib/trust-pages';

/**
 * As páginas de confiança (#218): `/about`, `/contact` e `/privacy`.
 *
 * Vivem em `lib/trust-pages.ts` em Markdown e são renderizadas daqui, para o HTML e
 * para a rota de Markdown dizerem a mesma coisa em vez de duas versões que divergem.
 *
 * `dynamicParams = false` é o que mantém o resto a dar 404: sem isto, qualquer
 * endereço desconhecido cairia aqui e buscaria uma página de confiança que não existe.
 */

const byKey = (key: PageKey): Metadata => ({
  title: PAGES[key].title,
  description: PAGES[key].description,
  alternates: { canonical: `/${key}` },
  robots: { index: true, follow: true },
  openGraph: {
    title: PAGES[key].title,
    description: PAGES[key].description,
    url: `/${key}`,
    locale: 'pt_AO',
    type: 'website',
    siteName: 'Kixi',
  },
  twitter: { card: 'summary_large_image', title: PAGES[key].title, description: PAGES[key].description },
});

export async function generateMetadata({ params }: { params: Promise<{ path: string }> }): Promise<Metadata> {
  const { path } = await params;
  const key = path as PageKey;
  // Um caminho que não é página de confiança fica sem metadata: quem o trata é o 404.
  return key in PAGES ? byKey(key) : {};
}

export function generateStaticParams() {
  return Object.keys(PAGES).map((path) => ({ path }));
}

/** Qualquer outro caminho é uma página que não existe, e o 404 do Next trata dela. */
export const dynamicParams = false;

export default async function TrustPage({ params }: { params: Promise<{ path: string }> }) {
  const { path } = await params;
  const key = path as PageKey;
  if (!(key in PAGES)) notFound();

  return (
    <div className="wrap">
      <a href="#conteudo" className="skip">Saltar para o conteúdo</a>
      <Header />
      <main id="conteudo" tabIndex={-1} className="lp-stack trust">
        {markdownToReact(PAGES[key].markdown, key)}
        {key === 'about' && (
          <p className="actions">
            <Link href="/contact" className="kx-btn kx-btn--lg">
              <span className="kx-btn__label">Falar connosco</span>
            </Link>
          </p>
        )}
      </main>
      <Footer />
    </div>
  );
}
