'use client';

import { track } from '@/lib/analytics';

export type CtaOrigem = 'header' | 'outro' | 'faq' | 'hero';

/**
 * Botão-âncora da landing que regista de onde veio o clique (#512): o evento
 * `cta_clique` leva a origem (header/outro/faq). Sem consentimento não há
 * `gtag` e o clique navega na mesma — `track` nesses casos não faz nada.
 */
/**
 * Ligação interna que também conta de onde veio (#762). O «Doar um enunciado» vive na
 * navegação e no herói; cada sítio manda a sua `origem` em `cta_clique`, para sabermos
 * qual deles traz doações — e não só cliques em «Criar conta».
 */
export function TrackedLink({ href, origem, className, children }: {
  href: string;
  origem: CtaOrigem;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <a href={href} className={className} onClick={() => track('cta_clique', { origem })}>
      {children}
    </a>
  );
}

export function Cta({ href, origem, size = 'lg', secondary, children }: {
  href: string;
  origem: CtaOrigem;
  size?: 'sm' | 'lg';
  secondary?: boolean;
  children: React.ReactNode;
}) {
  return (
    <span className="kx-btn-wrap kx-scope">
      <a
        href={href}
        onClick={() => track('cta_clique', { origem })}
        className={`kx-btn kx-btn--${size}${secondary ? ' kx-btn--secondary' : ' kx-btn--a'}`}
        style={{ textDecoration: 'none' }}
      >
        <span className="kx-btn__label">{children}</span>
      </a>
    </span>
  );
}
