import type { Metadata, Viewport } from 'next';
import './globals.css';
import { CookieBanner } from '@/components/consent/Consent';
import { appOrigin } from '@/lib/origin';

export const metadata: Metadata = {
  title: 'Kixi',
  description: 'Provas, simulações e tutor para estudar com a tua turma.',
};

export const viewport: Viewport = { themeColor: '#1f5a2c', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-AO" data-theme="light" data-reduce-motion="false" suppressHydrationWarning>
      <head>
        {/* Aplica a preferência de movimento guardados antes de pintar, para não piscar. */}
        <script dangerouslySetInnerHTML={{ __html: "try{var m=localStorage.getItem('kixi-reduce-motion');if(m)document.documentElement.setAttribute('data-reduce-motion',m)}catch(e){}" }} />
      </head>
      {/* `--ck-banner-h` (#506): enquanto o banner de cookies estiver em baixo, o fim do documento
       *  ganha esse espaço, para que nenhuma página acabe com ações por baixo dele. */}
      <body className="pb-[var(--ck-banner-h,0px)]">
        {children}
        {/* #219: analítica mínima, só depois deste banner ser aceite. */}
        <CookieBanner landingOrigin={appOrigin()} />
      </body>
    </html>
  );
}
