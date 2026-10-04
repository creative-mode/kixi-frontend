import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Kixi',
  description: 'Estuda, dispara, domina. A plataforma de provas e estudo feita por alunos, para alunos.',
};

export const viewport: Viewport = { themeColor: '#a8b389', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt" data-theme="light">
      <body>
        <div className="app">{children}</div>
      </body>
    </html>
  );
}
