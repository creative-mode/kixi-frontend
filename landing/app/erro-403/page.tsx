import type { Metadata } from 'next';
import Link from 'next/link';
import ForbiddenScene from '@/components/forbidden/forbidden-scene';
import { Logo } from '@/components/kixi';
import { getForbiddenReason } from '@/lib/forbidden-reasons';
import '@/components/forbidden/forbidden.css';
import { ErrorView } from '@/components/analytics/trackers';

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
    <>
      <ErrorView app="landing" kind="forbidden" />
      <ForbiddenScene
        // Só o logo: o menu da landing («Criar conta», «Entrar», «Doar um enunciado») não faz sentido a quem já tem sessão e
        // chegou aqui por não ter acesso (G6).
        header={(
          <header className="site-header">
            <div className="wrap site-header__in">
              <Link href="/" aria-label="Kixi, início" className="site-header__logo">
                <Logo size={28} wordmark />
              </Link>
            </div>
          </header>
        )}
        hint={config.message}
        primary={button(config.primary.href, config.primary.label)}
        secondary={config.secondary ? button(config.secondary.href, config.secondary.label) : undefined}
      />
    </>
  );
}
