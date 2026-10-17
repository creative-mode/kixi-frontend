'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FileText, House, MessageCircle, Plus, Search, Trophy, User, type LucideIcon } from 'lucide-react';
import { Logo } from './brand';
import { RightRail } from './right-rail';
import { UserAvatar } from './user-avatar';
import { handle, me } from '@/lib/data';
import { cn } from '@/lib/utils';

const ITEMS: { href: string; label: string; icon: LucideIcon; also: string[] }[] = [
  { href: '/inicio', label: 'Início', icon: House, also: [] },
  { href: '/provas', label: 'Provas', icon: FileText, also: ['/prova', '/resultado'] },
  { href: '/ranking', label: 'Liga', icon: Trophy, also: [] },
  { href: '/tutor', label: 'Tutor', icon: MessageCircle, also: [] },
  { href: '/perfil', label: 'Perfil', icon: User, also: [] },
];

/**
 * Modelo social do aluno: barra lateral à esquerda, coluna central e coluna à direita.
 * Em tablet a barra fica só com ícones; no telemóvel passa a barra inferior com ícones.
 */
export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const on = (it: (typeof ITEMS)[number]) => [it.href, ...it.also].some((p) => path === p || path.startsWith(p + '/'));

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[1280px] justify-center">
      <aside className="sticky top-0 hidden h-dvh w-[88px] flex-none flex-col px-2 py-2 md:flex xl:w-[260px] xl:px-3">
        <Link href="/inicio" aria-label="Kixi, início" className="grid h-14 place-items-center rounded-full hover:bg-secondary xl:inline-flex xl:place-items-start xl:justify-start xl:px-3 xl:pt-3.5"><Logo size={26} wordmark className="max-xl:hidden" /><Logo size={26} className="xl:hidden" /></Link>
        <nav aria-label="Principal" className="mt-1 grid gap-0.5">
          {ITEMS.map((it) => (
            <Link key={it.href} href={it.href} aria-label={it.label} aria-current={on(it) ? 'page' : undefined} className="group flex h-[52px] items-center justify-center gap-5 rounded-full text-foreground transition-colors hover:bg-secondary xl:justify-start xl:px-4">
              <it.icon className="size-[26px] group-aria-[current=page]:stroke-[2.4]" strokeWidth={1.7} />
              <span className="hidden text-xl group-aria-[current=page]:font-bold xl:inline">{it.label}</span>
            </Link>
          ))}
        </nav>
        <Link href="/inicio#publicar" className="mt-4 inline-flex h-[52px] items-center justify-center rounded-full bg-primary text-[17px] font-bold text-primary-foreground hover:bg-primary/90 max-xl:mx-auto max-xl:size-[52px] xl:mx-2" aria-label="Publicar">
          <Plus className="size-6 xl:hidden" strokeWidth={2.4} /><span className="hidden xl:inline">Publicar</span>
        </Link>
        <Link href="/perfil" className="mt-auto flex items-center gap-3 rounded-full p-2.5 hover:bg-secondary max-xl:justify-center">
          <UserAvatar name={me.name} size={40} />
          <span className="hidden min-w-0 flex-1 leading-tight xl:block"><span className="block truncate text-[15px] font-bold">{me.name}</span><span className="block truncate text-[13px] text-muted-foreground">{handle(me.name)} · {me.turma} {me.escola}</span></span>
        </Link>
      </aside>

      <div className="min-h-dvh w-full max-w-[600px] min-w-0 border-x">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b bg-background/95 px-4 backdrop-blur md:hidden">
          <Link href="/perfil" aria-label="O teu perfil"><UserAvatar name={me.name} size={32} /></Link>
          <Link href="/inicio" aria-label="Kixi, início"><Logo size={24} wordmark /></Link>
          <Link href="/provas" aria-label="Procurar provas" className="grid size-9 place-items-center rounded-full hover:bg-secondary"><Search className="size-5" /></Link>
        </header>
        {children}
      </div>

      <RightRail />

      {path === '/inicio' && (
        <Link href="/inicio#publicar" aria-label="Publicar" className="fixed right-4 bottom-[72px] z-30 grid size-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-md md:hidden">
          <Plus className="size-7" strokeWidth={2.4} />
        </Link>
      )}

      <nav aria-label="Principal" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        {ITEMS.map((it) => (
          <Link key={it.href} href={it.href} aria-label={it.label} aria-current={on(it) ? 'page' : undefined} className={cn('grid h-[52px] place-items-center text-muted-foreground aria-[current=page]:text-foreground')}>
            <it.icon className="size-[26px]" strokeWidth={on(it) ? 2.4 : 1.7} />
          </Link>
        ))}
      </nav>
    </div>
  );
}
