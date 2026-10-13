'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

const TONES = [
  'bg-accent text-accent-foreground',
  'bg-info-soft text-info',
  'bg-warning-soft text-warning',
  'bg-secondary text-foreground',
  'bg-danger-soft text-destructive',
];
const tone = (s: string) => [...s].reduce((a, c) => a + c.charCodeAt(0), 0) % TONES.length;

export function initials(name: string) {
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] ?? '') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase();
}

/** Avatar com a foto quando existe e as iniciais quando não; a cor vem do nome, para a
 *  mesma pessoa ter sempre a mesma cor. O AvatarImage cai no fallback se a imagem falhar. */
export function UserAvatar({ name, src, size = 40, className }: { name: string; src?: string | null; size?: number; className?: string }) {
  return (
    <Avatar className={className} style={{ width: size, height: size }} aria-hidden="true">
      {src ? <AvatarImage src={src} alt="" /> : null}
      <AvatarFallback className={cn(TONES[tone(name)])} style={{ fontSize: Math.round(size * 0.38) }}>{initials(name)}</AvatarFallback>
    </Avatar>
  );
}
