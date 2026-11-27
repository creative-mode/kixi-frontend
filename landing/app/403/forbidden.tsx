import Link from 'next/link';
import { headers } from 'next/headers';
import { Logo } from '@/components/kixi';
import { FORBIDDEN_REASON_HEADER, getForbiddenReason } from '@/lib/forbidden-reasons';
import { ErrorView } from '@/components/analytics/trackers';

function button(href: string, label: string, secondary = false) {
  return (
    <span className="kx-btn-wrap kx-scope">
      <Link href={href} className={`kx-btn kx-btn--lg${secondary ? ' kx-btn--secondary' : ''}`} style={{ textDecoration: 'none' }}>
        <span className="kx-btn__label">{label}</span>
      </Link>
    </span>
  );
}

/**
 * A porta fechada. É a interface de `forbidden()` (ver `page.tsx`): é assim que o Next responde
 * 403 a sério, sem depender do proxy (G6/N7). O texto e os destinos vêm do motivo
 * (`lib/forbidden-reasons.ts`), coerentes com a app de onde a pessoa veio.
 */
export default async function Forbidden() {
  const config = getForbiddenReason((await headers()).get(FORBIDDEN_REASON_HEADER) ?? undefined);

  return (
    <div className="wrap nf">
      <ErrorView app="landing" kind="forbidden" />
      <a href="#conteudo" className="skip">Saltar para o conteúdo</a>
      {/* Só o logo: o menu da landing («Criar conta», «Entrar», «Doar um enunciado») não faz sentido a quem já tem
          sessão e chegou aqui por não ter acesso (G6). */}
      <header className="site-header">
        <div className="site-header__in">
          <Link href="/" aria-label="Kixi, início" className="site-header__logo">
            <Logo size={28} wordmark />
          </Link>
        </div>
      </header>
      <main id="conteudo" tabIndex={-1}>
        <p className="nf__code">Erro 403</p>
        <h1 className="nf__title">Acesso não permitido</h1>
        <p className="nf__message">{config.message}</p>
        <div className="actions nf__actions">
          {button(config.primary.href, config.primary.label)}
          {config.secondary ? button(config.secondary.href, config.secondary.label, true) : null}
        </div>
      </main>
    </div>
  );
}
