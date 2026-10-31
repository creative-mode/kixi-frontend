import type { Metadata, Viewport } from 'next';
import './globals.css';
import { CookieBanner } from '@/components/consent/Consent';
import { appOrigin } from '@/lib/origin';

export const metadata: Metadata = {
  title: 'Kixi',
  description: 'Provas, simulações e tutor para estudar com a tua turma.',
  icons: [
    { rel: 'apple-touch-icon', sizes: '180x180', url: '/student/icon/icon-192x192.png' },
    { rel: 'icon', type: 'image/x-icon', sizes: '32x32', url: '/student/icon/icon-192x192.png' },
  ],
  manifest: '/student/manifest.json',
};

export const viewport: Viewport = { themeColor: '#1f5a2c', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt" data-theme="light" data-reduce-motion="false" suppressHydrationWarning>
      <head>
        {/* Aplica a preferência de movimento guardados antes de pintar, para não piscar. */}
        <script dangerouslySetInnerHTML={{ __html: "try{var m=localStorage.getItem('kixi-reduce-motion');if(m)document.documentElement.setAttribute('data-reduce-motion',m)}catch(e){}" }} />
      </head>
      <body className="pb-[var(--ck-banner-h,0px)]">
        {children}
        <CookieBanner landingOrigin={appOrigin()} />
      </body>
    </html>
  );
}
