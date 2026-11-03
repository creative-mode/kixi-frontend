import type { Metadata } from 'next';
import Link from 'next/link';
import ForbiddenScene from '@/components/forbidden/forbidden-scene';
import { Header } from '@/components/sections/Header';
import { getForbiddenReason } from '@/lib/forbidden-reasons';
import '@/components/forbidden/forbidden.css';

export const metadata: Metadata = {
  title: '403 · Acesso não permitido',
  description: 'Área restrita do Kixi. A porta não abre para esta conta.',
  // Um 403 no índice é uma página de erro indexada: o buscador guarda-a, alguém
  // clica e leva a uma porta fechada. O `robots.txt` já a barra; isto é o pedido
  // explícito, para o que a busca já tenha guardado saber que já não vale.
  robots: { index: false, follow: false },
};

type PageProps = { searchParams: Promise<{ reason?: string | string[] }> };

function button(href: string, label: string) {
  return (
    <span className="kx-btn-wrap kx-scope">
      <Link href={href} className="kx-btn kx-btn--lg" style={{ textDecoration: 'none' }}>
        <span className="kx-btn__label">{label}</span>
      </Link>
    </span>
  );
}

export default async function ForbiddenPage({ searchParams }: PageProps) {
  const raw = (await searchParams).reason;
  const reason = Array.isArray(raw) ? raw[0] : raw;
  const config = getForbiddenReason(reason);

  return (
    <ForbiddenScene
      header={<Header />}
      hint={config.message}
      primary={button(config.primary.href, config.primary.label)}
      secondary={config.secondary ? button(config.secondary.href, config.secondary.label) : undefined}
    />
  );
}
