import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Kixi',
  description: 'Provas, simulações e tutor para estudar com a tua turma.',
};

export const viewport: Viewport = { themeColor: '#1f5a2c', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt">
      <body>{children}</body>
    </html>
  );
}
