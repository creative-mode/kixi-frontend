import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import { CookieBanner } from '@/components/consent/Consent';
import { appOrigin } from '@/lib/origin';

// Tipos do design system Kixi, self-hosted (mesma variável do gestor em app/layout.tsx).
const jakarta = localFont({
  src: [
    { path: '../public/fonts/plus-jakarta-sans-latin-400-normal.woff2', weight: '400' },
    { path: '../public/fonts/plus-jakarta-sans-latin-600-normal.woff2', weight: '600' },
    { path: '../public/fonts/plus-jakarta-sans-latin-700-normal.woff2', weight: '700' },
  ],
  variable: '--ff-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Kixi',
  description: 'Provas, simulações e tutor para estudar com a tua turma.',
  manifest: '/aluno/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Kixi',
  },
  icons: [
    { rel: 'apple-touch-icon', sizes: '180x180', url: '/aluno/icon/icon-192x192.png' },
    { rel: 'icon', type: 'image/png', sizes: '32x32', url: '/aluno/icon/icon-192x192.png' },
  ],
};

export const viewport: Viewport = { themeColor: '#1f5a2c', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-AO" data-theme="light" data-reduce-motion="false" suppressHydrationWarning>
      <head>
        {/* Aplica a preferência de movimento guardada antes de pintar, para não piscar. */}
        <script dangerouslySetInnerHTML={{ __html: "try{var m=localStorage.getItem('kixi-reduce-motion');if(m)document.documentElement.setAttribute('data-reduce-motion',m)}catch(e){}" }} />
      </head>
      {/* `--ck-banner-h` (#506): enquanto o banner de cookies estiver em baixo, o fim do documento
       *  ganha esse espaço, para que nenhuma página acabe com ações por baixo dele. */}
      <body className={`${jakarta.variable} font-sans pb-[var(--ck-banner-h,0px)]`}>
        {children}
        {/* #219: analítica mínima, só depois deste banner ser aceite. */}
        <CookieBanner landingOrigin={appOrigin()} />
      </body>
    </html>
  );
}
