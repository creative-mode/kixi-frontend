import Link from 'next/link';
import { headers } from 'next/headers';
import ForbiddenScene from '@/components/forbidden/forbidden-scene';
import { Logo } from '@/components/kixi';
import { FORBIDDEN_REASON_HEADER, getForbiddenReason } from '@/lib/forbidden-reasons';
import '@/components/forbidden/forbidden.css';
import { ErrorView } from '@/components/analytics/trackers';

function button(href: string, label: string) {
  return (
    <span className="kx-btn-wrap kx-scope">
      <Link href={href} className="kx-btn kx-btn--lg" style={{ textDecoration: 'none' }}>
        <span className="kx-btn__label">{label}</span>
      </Link>
    </span>
  );
}

/**
 * O ecrã da porta fechada. É a interface de `forbidden()` (ver `page.tsx`): é assim que o Next responde
 * 403 a sério, sem depender do proxy (G6/N7).
 */
export default async function Forbidden() {
  const config = getForbiddenReason((await headers()).get(FORBIDDEN_REASON_HEADER) ?? undefined);

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
