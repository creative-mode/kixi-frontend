'use client';

import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { track } from '@/lib/analytics';

/** De onde partiu o clique em «Doar um enunciado» dentro da app do aluno (#762). */
export type DonateOrigem = 'provas' | 'provas-empty' | 'student-menu';

/**
 * Ligação para a página pública de doação, que vive na landing.
 *
 * O aluno e a landing são apps separadas, por isso é um `<a>` normal e não um
 * `next/link`: o destino está noutra app. O clique leva a origem em `cta_clique`,
 * para sabermos qual entrada traz doações — o cartão de `/provas`, o estado vazio
 * ou o menu da conta. Sem consentimento o `track` não faz nada e a navegação segue.
 */
export function DonateLink({
  href,
  origem,
  children,
  onClick,
  ...rest
}: {
  href: string;
  origem: DonateOrigem;
  children: ReactNode;
} & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'>) {
  return (
    <a
      {...rest}
      href={href}
      onClick={(event) => {
        track('cta_clique', { origem });
        onClick?.(event);
      }}
    >
      {children}
    </a>
  );
}
