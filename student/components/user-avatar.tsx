'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
 *  mesma pessoa ter sempre a mesma cor. O AvatarImage cai no fallback se a imagem falhar.
 *
 *  `src` é obrigatório de propósito: um avatar do próprio aluno sem foto caía nas
 *  iniciais sem dar erro nenhum (#345). Quem é outra pessoa passa `null` explicitamente. */
export function UserAvatar({ name, src, size = 40, className }: { name: string; src: string | null | undefined; size?: number; className?: string }) {
  return (
    <Avatar className={className} style={{ width: size, height: size }} aria-hidden="true">
      {src ? <AvatarImage src={assetUrl(src)} alt="" /> : null}
      <AvatarFallback className={cn(TONES[tone(name)])} style={{ fontSize: Math.round(size * 0.38) }}>{initials(name)}</AvatarFallback>
    </Avatar>
  );
}
