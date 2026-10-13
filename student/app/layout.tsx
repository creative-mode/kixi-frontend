import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Kixi',
  description: 'Provas, simulações e tutor para estudar com a tua turma.',
};

export const viewport: Viewport = { themeColor: '#1f5a2c', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt" data-theme="light" data-reduce-motion="false" suppressHydrationWarning>
      <head>
        {/* Aplica o tema e a preferência de movimento guardados antes de pintar, para não piscar. */}
        <script dangerouslySetInnerHTML={{ __html: "try{var t=localStorage.getItem('kixi-theme');if(t)document.documentElement.setAttribute('data-theme',t);var m=localStorage.getItem('kixi-reduce-motion');if(m)document.documentElement.setAttribute('data-reduce-motion',m)}catch(e){}" }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
