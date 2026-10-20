'use client';

import { useState } from 'react';
import { initials } from '@/lib/profile';
import { cn } from '@/lib/utils';
import { assetUrl } from '@/lib/assets';

const TONES = [
  'bg-accent text-accent-foreground',
  'bg-info-soft text-info',
  'bg-warning-soft text-warning',
  'bg-secondary text-foreground',
  'bg-danger-soft text-destructive',
];
const tone = (s: string) => [...s].reduce((a, c) => a + c.charCodeAt(0), 0) % TONES.length;


/** Avatar com a foto quando existe e as iniciais quando não; a cor vem do nome, para a
 *  mesma pessoa ter sempre a mesma cor. Se a imagem falhar, ficam as iniciais.
 *
 *  `src` é obrigatório de propósito: um avatar do próprio aluno sem foto caía nas
 *  iniciais sem dar erro nenhum (#345). Quem é outra pessoa passa `null` explicitamente. */
export function UserAvatar({ name, src, size = 40, className }: { name: string; src: string | null | undefined; size?: number; className?: string }) {
  const [failed, setFailed] = useState(false);
  // A imagem vem no próprio HTML (`<img>` por cima das iniciais) e o browser começa a descarregá-la com a página, sem esperar
  // pelo JavaScript: antes o Radix só a pedia depois de hidratar, e em rede lenta isso eram segundos a mais.
  // Se falhar antes de a página hidratar, o `onError` ainda não existe: a conferência abaixo apanha esse caso.
  const check = (img: HTMLImageElement | null) => {
    if (img && img.complete && img.naturalWidth === 0) setFailed(true);
  };
  return (
    <span data-slot="avatar" aria-hidden="true" className={cn('relative inline-grid shrink-0 overflow-hidden rounded-full', className)} style={{ width: size, height: size }}>
      <span data-slot="avatar-fallback" className={cn('grid size-full place-items-center rounded-full font-bold', TONES[tone(name)])} style={{ fontSize: Math.round(size * 0.38) }}>{initials(name)}</span>
      {src && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img ref={check} src={assetUrl(src, size)} alt="" width={size} height={size} loading="lazy" decoding="async" onError={() => setFailed(true)} className="absolute inset-0 aspect-square size-full object-cover" />
      ) : null}
    </span>
  );
}
