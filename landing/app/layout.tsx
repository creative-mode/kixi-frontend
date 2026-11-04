import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import { SITE_URL } from '@/lib/content';
import { CookieBanner } from '@/components/consent/Consent';
import { PageViewTracker, ScrollDepthTracker } from '@/components/analytics/trackers';
import './globals.css';
import '@/styles/legal.css';

// Tipos do design system, self-hosted com next/font (#521): sem FOUT nem salto de layout nos títulos. As variáveis
// vão no <html>, e não no <body>, porque os tokens (`--font-sans: var(--ff-sans, …)`) resolvem-se no :root.
const jakarta = localFont({
  src: [
    { path: './fonts/plus-jakarta-sans-latin-400-normal.woff2', weight: '400' },
    { path: './fonts/plus-jakarta-sans-latin-600-normal.woff2', weight: '600' },
    { path: './fonts/plus-jakarta-sans-latin-700-normal.woff2', weight: '700' },
  ],
  variable: '--ff-sans',
  display: 'swap',
});

const mono = localFont({
  src: './fonts/jetbrains-mono-latin-500-normal.woff2',
  weight: '500',
  variable: '--ff-mono',
  display: 'swap',
});

const pixel = localFont({
  src: './fonts/press-start-2p-latin-400-normal.woff2',
  weight: '400',
  variable: '--ff-pixel',
  display: 'swap',
});

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
    <html lang="pt-AO" data-theme="light" className={`${jakarta.variable} ${mono.variable} ${pixel.variable}`}>
      <body>
        {children}
        {/* #714: page_view por rota e scroll_depth, só com consentimento (lib/analytics.ts). */}
        <PageViewTracker app="landing" />
        <ScrollDepthTracker />
        <CookieBanner />
      </body>
    </html>
  );
}
