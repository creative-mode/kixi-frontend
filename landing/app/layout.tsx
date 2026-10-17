import type { Metadata, Viewport } from 'next';
import { SITE_URL } from '@/lib/content';
import { CookieBanner } from '@/components/consent/Consent';
import './globals.css';
import '@/styles/legal.css';

const TITLE = 'Kixi · Estuda. Dispara. Domina.';
const DESCRIPTION =
  'O Kixi transforma cada prova num gémeo digital: simulações, um tutor de IA que conhece cada questão e uma rede de estudo entre escolas. Feito por alunos do ITEL, para alunos.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  openGraph: { title: TITLE, description: DESCRIPTION, url: '/', locale: 'pt_AO', type: 'website', siteName: 'Kixi' },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION },
};

export const viewport: Viewport = { themeColor: '#a3d97f', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt" data-theme="light">
      <body>
        {children}
        <CookieBanner />
      </body>
    </html>
  );
}
