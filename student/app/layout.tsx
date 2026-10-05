import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Kixi',
  description: 'Provas, simulações e tutor para estudar com a tua turma.',
};

export const viewport: Viewport = { themeColor: '#27311b', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt" data-theme="light" suppressHydrationWarning>
      <head>
        {/* Aplica o tema guardado antes de pintar, para não piscar. */}
        <script dangerouslySetInnerHTML={{ __html: "try{var t=localStorage.getItem('kixi-theme');if(t)document.documentElement.setAttribute('data-theme',t)}catch(e){}" }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
